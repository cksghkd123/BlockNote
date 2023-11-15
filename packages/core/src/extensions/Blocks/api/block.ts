import { Attribute, Attributes, Editor, Node, NodeConfig } from "@tiptap/core";
import { ParseRule } from "prosemirror-model";
import { BlockNoteEditor } from "../../../BlockNoteEditor";
import { mergeCSSClasses } from "../../../shared/utils";
import { defaultBlockToHTML } from "../nodes/BlockContent/defaultBlockHelpers";
import {
  BlockConfig,
  BlockSchemaWithBlock,
  BlockSpec,
  PropSchema,
  Props,
  SpecificBlock,
  TiptapBlockImplementation,
} from "./blockTypes";
import { inheritedProps } from "./defaultProps";

export function camelToDataKebab(str: string): string {
  return "data-" + str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

// Function that uses the 'propSchema' of a blockConfig to create a TipTap
// node's `addAttributes` property.
export function propsToAttributes(blockConfig: BlockConfig): Attributes {
  const tiptapAttributes: Record<string, Attribute> = {};

  Object.entries(blockConfig.propSchema)
    .filter(([name, _spec]) => !inheritedProps.includes(name))
    .forEach(([name, spec]) => {
      tiptapAttributes[name] = {
        default: spec.default,
        keepOnSplit: true,
        // Props are displayed in kebab-case as HTML attributes. If a prop's
        // value is the same as its default, we don't display an HTML
        // attribute for it.
        parseHTML: (element) => {
          const value = element.getAttribute(camelToDataKebab(name));

          if (value === null) {
            return null;
          }

          if (typeof spec.default === "boolean") {
            if (value === "true") {
              return true;
            }

            if (value === "false") {
              return false;
            }

            return null;
          }

          if (typeof spec.default === "number") {
            const asNumber = parseFloat(value);
            const isNumeric =
              !Number.isNaN(asNumber) && Number.isFinite(asNumber);

            if (isNumeric) {
              return asNumber;
            }

            return null;
          }

          return value;
        },
        renderHTML: (attributes) =>
          attributes[name] !== spec.default
            ? {
                [camelToDataKebab(name)]: attributes[name],
              }
            : {},
      };
    });

  return tiptapAttributes;
}

// Function that uses the 'parse' function of a blockConfig to create a
// TipTap node's `parseHTML` property. This is only used for parsing content
// from the clipboard.
export function parse(blockConfig: BlockConfig) {
  const rules: ParseRule[] = [
    {
      tag: "div[data-content-type=" + blockConfig.type + "]",
    },
  ];

  // if (blockConfig.parse) {
  //   rules.push({
  //     tag: "*",
  //     getAttrs(node: string | HTMLElement) {
  //       if (typeof node === "string") {
  //         return false;
  //       }
  //
  //       const block = blockConfig.parse?.(node);
  //
  //       if (block === undefined) {
  //         return false;
  //       }
  //
  //       return block.props || {};
  //     },
  //     getContent(node, schema) {
  //       const block = blockConfig.parse?.(node as HTMLElement);
  //
  //       if (block !== undefined && block.content !== undefined) {
  //         return Fragment.from(
  //           typeof block.content === "string"
  //             ? schema.text(block.content)
  //             : inlineContentToNodes(block.content, schema)
  //         );
  //       }
  //
  //       return Fragment.empty;
  //     },
  //   });
  // }

  return rules;
}

// Used to figure out which block should be rendered. This block is then used to
// create the node view.
export function getBlockFromPos<
  BType extends string,
  PSchema extends PropSchema,
  BSchema extends BlockSchemaWithBlock<BType, PSchema>
>(
  getPos: (() => number) | boolean,
  editor: BlockNoteEditor<BSchema>,
  tipTapEditor: Editor,
  type: BType
) {
  // Gets position of the node
  if (typeof getPos === "boolean") {
    throw new Error(
      "Cannot find node position as getPos is a boolean, not a function."
    );
  }
  const pos = getPos();
  // Gets parent blockContainer node
  const blockContainer = tipTapEditor.state.doc.resolve(pos!).node();
  // Gets block identifier
  const blockIdentifier = blockContainer.attrs.id;
  // Gets the block
  const block = editor.getBlock(blockIdentifier)! as SpecificBlock<
    BSchema,
    BType
  >;
  if (block.type !== type) {
    throw new Error("Block type does not match");
  }

  return block;
}

// Function that wraps the `dom` element returned from 'blockConfig.render' in a
// `blockContent` div, which contains the block type and props as HTML
// attributes. If `blockConfig.render` also returns a `contentDOM`, it also adds
// an `inlineContent` class to it.
export function wrapInBlockStructure<
  BType extends string,
  PSchema extends PropSchema
>(
  element: {
    dom: HTMLElement;
    contentDOM?: HTMLElement;
    destroy?: () => void;
  },
  blockType: BType,
  blockProps: Props<PSchema>,
  propSchema: PSchema,
  domAttributes?: Record<string, string>
): {
  dom: HTMLElement;
  contentDOM?: HTMLElement;
  destroy?: () => void;
} {
  // Creates `blockContent` element
  const blockContent = document.createElement("div");

  // Adds custom HTML attributes
  if (domAttributes !== undefined) {
    for (const [attr, value] of Object.entries(domAttributes)) {
      if (attr !== "class") {
        blockContent.setAttribute(attr, value);
      }
    }
  }
  // Sets blockContent class
  blockContent.className = mergeCSSClasses(
    "bn-block-content",
    domAttributes?.class || ""
  );
  // Sets content type attribute
  blockContent.setAttribute("data-content-type", blockType);
  // Adds props as HTML attributes in kebab-case with "data-" prefix. Skips props
  // which are already added as HTML attributes to the parent `blockContent`
  // element (inheritedProps) and props set to their default values.
  for (const [prop, value] of Object.entries(blockProps)) {
    if (!inheritedProps.includes(prop) && value !== propSchema[prop].default) {
      blockContent.setAttribute(camelToDataKebab(prop), value);
    }
  }

  blockContent.appendChild(element.dom);

  if (element.contentDOM !== undefined) {
    element.contentDOM.className = mergeCSSClasses(
      "bn-inline-content",
      element.contentDOM.className
    );
  }

  return {
    ...element,
    dom: blockContent,
  };
}

// Helper type to keep track of the `name` and `content` properties after calling Node.create.
type StronglyTypedTipTapNode<
  Name extends string,
  Content extends "inline*" | "table" | "tableRow+" | ""
> = Node & { name: Name; content: Content };

export function createStronglyTypedTiptapNode<
  Name extends string,
  Content extends "inline*" | "table" | "tableRow+" | ""
>(config: NodeConfig & { name: Name; content: Content }) {
  return Node.create(config) as StronglyTypedTipTapNode<Name, Content>; // force re-typing (should be safe as it's type-checked from the config)
}

export function createInternalBlockSpec<T extends BlockConfig>(
  config: T,
  implementation: TiptapBlockImplementation<T>
) {
  return {
    config,
    implementation,
  } satisfies BlockSpec<T>;
}

export function createBlockSpecFromStronglyTypedTiptapNode<
  T extends Node,
  P extends PropSchema
>(node: T, propSchema: P, requiredNodes?: Node[]) {
  return createInternalBlockSpec(
    {
      type: node.name as T["name"],
      content: "inline",
      propSchema,
    },
    {
      node,
      requiredNodes,
      toInternalHTML: defaultBlockToHTML,
      toExternalHTML: defaultBlockToHTML,
    }
  );
}
