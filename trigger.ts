import { Editor } from "obsidian";

export interface TriggerResult {
  query: string;
  lineNumber: number;
}

export function extractQuery(line: string, prefix: string): string | null {
  const trimmed = line.trimStart();

  if (!trimmed.startsWith(prefix)) {
    return null;
  }

  const query = trimmed.slice(prefix.length).trim();
  if (query.length === 0) {
    return null;
  }

  return query;
}

export function findTrigger(editor: Editor, prefix: string = ";;"): TriggerResult | null {
  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);
  const query = extractQuery(line, prefix);

  if (query === null) {
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
