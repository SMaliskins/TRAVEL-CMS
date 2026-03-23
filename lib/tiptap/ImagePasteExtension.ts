import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";

/** Extension that inserts images from clipboard (Ctrl+V) as base64. */
export const ImagePasteExtension = Extension.create({
  name: "imagePaste",
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey("imagePaste"),
        props: {
          handlePaste: (view, event) => {
            const items = Array.from(event.clipboardData?.items ?? []);
            for (const item of items) {
              if (item.type.startsWith("image/")) {
                event.preventDefault();
                const file = item.getAsFile();
                if (file) {
                  const reader = new FileReader();
                  reader.onload = () => {
                    const src = reader.result as string;
                    if (src) {
                      editor.chain().focus().setImage({ src }).run();
                    }
                  };
                  reader.readAsDataURL(file);
                }
                return true;
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});
