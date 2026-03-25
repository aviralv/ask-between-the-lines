import { Editor } from "obsidian";

export function replaceLine(editor: Editor, lineNumber: number, text: string): void {
  const from = { line: lineNumber, ch: 0 };
  const lineLength = editor.getLine(lineNumber).length;
  const to = { line: lineNumber, ch: lineLength };
  editor.replaceRange(text, from, to);
}

export function findThinkingCallout(editor: Editor, query: string): number | null {
  const marker = formatThinkingCalloutWithQuery(query);
  const totalLines = editor.lineCount();
  for (let i = 0; i < totalLines; i++) {
    if (editor.getLine(i) === marker) {
      return i;
    }
  }
  return null;
}

export function formatThinkingCalloutWithQuery(query: string): string {
  return `> [!ai] Thinking... (${query})`;
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
