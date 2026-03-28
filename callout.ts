import { Editor } from "obsidian";

export type SessionStatus = "new" | "continued";

export function replaceLine(editor: Editor, lineNumber: number, text: string): void {
  const from = { line: lineNumber, ch: 0 };
  const lineLength = editor.getLine(lineNumber).length;
  const to = { line: lineNumber, ch: lineLength };
  editor.replaceRange(text, from, to);
}

export function findThinkingCallout(editor: Editor, query: string): number | null {
  const totalLines = editor.lineCount();
  for (let i = 0; i < totalLines; i++) {
    const line = editor.getLine(i);
    if (line.startsWith("> [!ai] Thinking") && line.endsWith(`(${query})`)) {
      return i;
    }
  }
  return null;
}

export function formatThinkingCallout(
  query: string,
  sessionStatus?: SessionStatus,
): string {
  if (sessionStatus === "new") {
    return `> [!ai] Thinking (new)... (${query})`;
  }
  if (sessionStatus === "continued") {
    return `> [!ai] Thinking (cont'd)... (${query})`;
  }
  return `> [!ai] Thinking... (${query})`;
}

/** @deprecated Use formatThinkingCallout instead */
export function formatThinkingCalloutWithQuery(query: string): string {
  return formatThinkingCallout(query);
}

export interface ResponseMetadata {
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

export function formatResponseCallout(
  query: string,
  response: string,
  metadata?: ResponseMetadata,
  sessionStatus?: SessionStatus,
): string {
  const responseLines = response
    .split("\n")
    .map((line) => "> " + line)
    .join("\n");

  let callout = `> [!ai]- ${query}\n${responseLines}`;

  if (metadata) {
    const seconds = (metadata.durationMs / 1000).toFixed(1);
    let footer = `${metadata.inputTokens} in · ${metadata.outputTokens} out · ${seconds}s`;
    if (sessionStatus === "new") {
      footer += " · new session";
    } else if (sessionStatus === "continued") {
      footer += " · continued";
    }
    callout += `\n>\n> *${footer}*`;
  }

  return callout;
}

export function formatErrorCallout(errorMessage: string): string {
  return `> [!error]- Ask failed\n> ${errorMessage}`;
}
