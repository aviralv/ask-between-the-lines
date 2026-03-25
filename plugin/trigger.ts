import { Editor } from "obsidian";

export interface TriggerResult {
  query: string;
  lineNumber: number;
}

export function findTrigger(editor: Editor): TriggerResult | null {
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
    lineNumber: cursor.line,
  };
}

export function getDocumentWithoutTriggerLine(editor: Editor, triggerLine: number): string {
  const totalLines = editor.lineCount();
  const lines: string[] = [];

  for (let i = 0; i < totalLines; i++) {
    if (i !== triggerLine) {
      lines.push(editor.getLine(i));
    }
  }

  return lines.join("\n");
}
