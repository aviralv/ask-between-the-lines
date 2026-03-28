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

export function getDocumentContext(editor: Editor, triggerLine: number): string {
  const totalLines = editor.lineCount();
  const selection = editor.getSelection();
  const hasSelection = selection.length > 0;

  let selectionRange: { startLine: number; endLine: number } | null = null;
  if (hasSelection) {
    const selections = editor.listSelections();
    if (selections.length > 0) {
      const sel = selections[0];
      selectionRange = {
        startLine: Math.min(sel.anchor.line, sel.head.line),
        endLine: Math.max(sel.anchor.line, sel.head.line),
      };
    }
  }

  const lines: string[] = [];
  for (let i = 0; i < totalLines; i++) {
    if (i === triggerLine) {
      lines.push("<<< CURSOR >>>");
      continue;
    }

    if (selectionRange && i === selectionRange.startLine) {
      lines.push("<<< SELECTION START >>>");
    }

    lines.push(editor.getLine(i));

    if (selectionRange && i === selectionRange.endLine) {
      lines.push("<<< SELECTION END >>>");
    }
  }

  return lines.join("\n");
}
