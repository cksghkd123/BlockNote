import {
  Block,
  BlockSchema,
  PartialBlock,
  TableContent,
} from "../../extensions/Blocks/api/blockTypes";
import {
  InlineContent,
  PartialInlineContent,
  StyledText,
} from "../../extensions/Blocks/api/inlineContentTypes";

function textShorthandToStyledText(
  content: string | StyledText[] = ""
): StyledText[] {
  if (typeof content === "string") {
    return [
      {
        type: "text",
        text: content,
        styles: {},
      },
    ];
  }
  return content;
}

function partialContentToInlineContent(
  content: string | PartialInlineContent[] | TableContent = ""
): InlineContent[] | TableContent {
  if (typeof content === "string") {
    return textShorthandToStyledText(content);
  }

  if (Array.isArray(content)) {
    return content.map((partialContent) => {
      if (partialContent.type === "link") {
        return {
          ...partialContent,
          content: textShorthandToStyledText(partialContent.content),
        };
      } else {
        return partialContent;
      }
    });
  }

  return content;
}

export function partialBlockToBlockForTesting<BSchema extends BlockSchema>(
  partialBlock: PartialBlock<BSchema>
): Block<BSchema> {
  const withDefaults: Block<any> = {
    id: "",
    type: "paragraph",
    // because at this point we don't have an easy way to access default props at runtime,
    // partialBlockToBlockForTesting will not set them.
    props: {} as any,
    content: [] as any,
    children: [] as any,
    ...partialBlock,
  };

  return {
    ...withDefaults,
    content: partialContentToInlineContent(withDefaults.content),
    children: withDefaults.children.map(partialBlockToBlockForTesting),
  } as any;
}
