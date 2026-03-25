import { Plugin } from "obsidian";
import { findTrigger, getDocumentWithoutTriggerLine } from "./trigger";

export default class AskBetweenTheLines extends Plugin {
  async onload() {
    this.addCommand({
      id: "ask-inline",
      name: "Ask inline (send ;; query)",
      editorCallback: (editor) => {
        const trigger = findTrigger(editor);
        if (!trigger) {
          return;
        }

        const document = getDocumentWithoutTriggerLine(editor, trigger.lineNumber);
        console.log("Trigger found:", trigger.query);
        console.log("Document length:", document.length);
      },
      hotkeys: [
        { modifiers: ["Mod"], key: "Enter" },
      ],
    });
  }

  async onunload() {
    console.log("Ask Between the Lines unloaded");
  }
}
