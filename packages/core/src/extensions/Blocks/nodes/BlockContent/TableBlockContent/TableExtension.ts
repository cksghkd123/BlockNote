import { Extension, callOrReturn, getExtensionField } from "@tiptap/core";
import { columnResizing, tableEditing } from "prosemirror-tables";

export const TableExtension = Extension.create({
  name: "BlockNoteTableExtension",

  addProseMirrorPlugins: () => {
    return [
      columnResizing({
        cellMinWidth: 100,
      }),
      tableEditing(),
    ];
  },

  addKeyboardShortcuts() {
    return {
      // Ensures that backspace won't delete the table if the text cursor is at
      // the start of a cell and the selection is empty.
      Backspace: () => {
        const selection = this.editor.state.selection;
        const selectionIsEmpty = selection.empty;
        const selectionIsAtStartOfNode = selection.$head.parentOffset === 0;
        const selectionIsInTableParagraphNode =
          selection.$head.node().type.name === "tableParagraph";

        return (
          selectionIsEmpty &&
          selectionIsAtStartOfNode &&
          selectionIsInTableParagraphNode
        );
      },
    };
  },

  extendNodeSchema(extension) {
    const context = {
      name: extension.name,
      options: extension.options,
      storage: extension.storage,
    };

    return {
      tableRole: callOrReturn(
        getExtensionField(extension, "tableRole", context)
      ),
    };
  },
});