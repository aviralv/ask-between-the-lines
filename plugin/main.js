var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => AskBetweenTheLines
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// trigger.ts
function findTrigger(editor) {
  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);
  const trimmed = line.trimStart();
  if (!trimmed.startsWith(";;")) {
    return null;
  }
  const query = trimmed.slice(2).trim();
  if (query.length === 0) {
    return null;
  }
  return {
    query,
    lineNumber: cursor.line
  };
}
function getDocumentWithoutTriggerLine(editor, triggerLine) {
  const totalLines = editor.lineCount();
  const lines = [];
  for (let i = 0; i < totalLines; i++) {
    if (i !== triggerLine) {
      lines.push(editor.getLine(i));
    }
  }
  return lines.join("\n");
}

// main.ts
var AskBetweenTheLines = class extends import_obsidian.Plugin {
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
        { modifiers: ["Mod"], key: "Enter" }
      ]
    });
  }
  async onunload() {
    console.log("Ask Between the Lines unloaded");
  }
};
