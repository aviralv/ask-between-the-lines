import { Editor } from "obsidian";

export function replaceLine(editor: Editor, lineNumber: number, text: string): void {
  const from = { line: lineNumber, ch: 0 };
  const lineLength = editor.getLine(lineNumber).length;
  const to = { line: lineNumber, ch: lineLength };
  editor.replaceRange(text, from, to);
}

export function formatThinkingCallout(): string {
  return "> [!ai] Thinking...";
}

export function formatResponseCallout(query: string, response: string): string {
  const responseLines = response
    .split("\n")
    .map((line) => "> " + line)
    .join("\n");
  return `> [!ai]- ${query}\n${responseLines}`;
}

export function formatErrorCallout(errorMessage: string): string {
  return `> [!error]- Ask failed\n> ${errorMessage}`;
}
