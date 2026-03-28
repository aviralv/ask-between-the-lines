import { describe, it, expect } from "vitest";
import {
  formatResponseCallout,
  formatThinkingCallout,
  formatErrorCallout,
  findThinkingCallout,
  replaceLine,
} from "./callout";

function mockEditor(lines: string[]) {
  return {
    lineCount: () => lines.length,
    getLine: (i: number) => lines[i],
  } as any;
}

describe("formatResponseCallout with metadata", () => {
  it("appends token and duration footer", () => {
    const result = formatResponseCallout("What is this?", "A document.", {
      inputTokens: 523,
      outputTokens: 47,
      durationMs: 3200,
    });
    expect(result).toContain("> [!ai]- What is this?");
    expect(result).toContain("> A document.");
    expect(result).toContain("*523 in · 47 out · 3.2s*");
  });

  it("works without metadata", () => {
    const result = formatResponseCallout("Query", "Answer.");
    expect(result).toContain("> [!ai]- Query");
    expect(result).toContain("> Answer.");
    expect(result).not.toContain("*");
  });

  it("formats duration as seconds with one decimal", () => {
    const result = formatResponseCallout("Q", "A", {
      inputTokens: 10,
      outputTokens: 5,
      durationMs: 500,
    });
    expect(result).toContain("0.5s");
  });
});

describe("formatThinkingCallout", () => {
  it("formats one-shot thinking callout (no session info)", () => {
    const result = formatThinkingCallout("What is this?");
    expect(result).toBe("> [!ai] Thinking... (What is this?)");
  });

  it("formats new session thinking callout", () => {
    const result = formatThinkingCallout("What is this?", "new");
    expect(result).toBe("> [!ai] Thinking (new)... (What is this?)");
  });

  it("formats continued session thinking callout", () => {
    const result = formatThinkingCallout("What is this?", "continued");
    expect(result).toBe("> [!ai] Thinking (cont'd)... (What is this?)");
  });
});

describe("formatResponseCallout with session info", () => {
  it("appends 'new session' to footer", () => {
    const result = formatResponseCallout("Q", "A", {
      inputTokens: 100,
      outputTokens: 20,
      durationMs: 1000,
    }, "new");
    expect(result).toContain("*100 in · 20 out · 1.0s · new session*");
  });

  it("appends 'continued' to footer", () => {
    const result = formatResponseCallout("Q", "A", {
      inputTokens: 100,
      outputTokens: 20,
      durationMs: 1000,
    }, "continued");
    expect(result).toContain("*100 in · 20 out · 1.0s · continued*");
  });

  it("no session suffix for one-shot (undefined)", () => {
    const result = formatResponseCallout("Q", "A", {
      inputTokens: 100,
      outputTokens: 20,
      durationMs: 1000,
    });
    expect(result).toContain("*100 in · 20 out · 1.0s*");
    expect(result).not.toContain("session");
    expect(result).not.toContain("continued");
  });
});

describe("formatErrorCallout", () => {
  it("formats a basic error callout", () => {
    const result = formatErrorCallout("Something went wrong");
    expect(result).toBe("> [!error]- Ask failed\n> Something went wrong");
  });

  it("handles empty error message", () => {
    const result = formatErrorCallout("");
    expect(result).toBe("> [!error]- Ask failed\n> ");
  });
});

describe("findThinkingCallout", () => {
  it("finds thinking callout matching query", () => {
    const editor = mockEditor([
      "Some text",
      "> [!ai] Thinking... (What is this?)",
      "More text",
    ]);
    expect(findThinkingCallout(editor, "What is this?")).toBe(1);
  });

  it("finds new session thinking callout", () => {
    const editor = mockEditor([
      "> [!ai] Thinking (new)... (my query)",
    ]);
    expect(findThinkingCallout(editor, "my query")).toBe(0);
  });

  it("finds continued session thinking callout", () => {
    const editor = mockEditor([
      "> [!ai] Thinking (cont'd)... (my query)",
    ]);
    expect(findThinkingCallout(editor, "my query")).toBe(0);
  });

  it("returns null when no match", () => {
    const editor = mockEditor(["No callouts here"]);
    expect(findThinkingCallout(editor, "missing")).toBeNull();
  });

  it("returns first match when multiple exist", () => {
    const editor = mockEditor([
      "> [!ai] Thinking... (same query)",
      "text",
      "> [!ai] Thinking... (same query)",
    ]);
    expect(findThinkingCallout(editor, "same query")).toBe(0);
  });
});

describe("replaceLine", () => {
  it("replaces a line at the given position", () => {
    let replaced: { from: any; to: any; text: string } | null = null;
    const editor = {
      getLine: (i: number) => ["first", "second", "third"][i],
      replaceRange: (text: string, from: any, to: any) => {
        replaced = { from, to, text };
      },
    } as any;

    replaceLine(editor, 1, "new content");
    expect(replaced).toEqual({
      from: { line: 1, ch: 0 },
      to: { line: 1, ch: 6 },
      text: "new content",
    });
  });

  it("handles empty line replacement", () => {
    let replaced: any = null;
    const editor = {
      getLine: () => "",
      replaceRange: (text: string, from: any, to: any) => {
        replaced = { from, to, text };
      },
    } as any;

    replaceLine(editor, 0, "inserted");
    expect(replaced).toEqual({
      from: { line: 0, ch: 0 },
      to: { line: 0, ch: 0 },
      text: "inserted",
    });
  });
});
