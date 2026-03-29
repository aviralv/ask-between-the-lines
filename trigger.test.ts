import { describe, it, expect } from "vitest";
import { extractQuery, findTrigger, getDocumentWithoutTriggerLine, getDocumentContext } from "./trigger";

function mockEditor(lines: string[], cursorLine: number = 0) {
  return {
    getCursor: () => ({ line: cursorLine }),
    getLine: (i: number) => lines[i],
    lineCount: () => lines.length,
  } as any;
}

describe("extractQuery", () => {
  it("extracts query after ;; prefix", () => {
    const result = extractQuery(";;What is this?", ";;");
    expect(result).toBe("What is this?");
  });

  it("extracts query with leading whitespace", () => {
    const result = extractQuery("  ;;Some question", ";;");
    expect(result).toBe("Some question");
  });

  it("returns null for lines without prefix", () => {
    const result = extractQuery("No trigger here", ";;");
    expect(result).toBeNull();
  });

  it("returns null for empty query after prefix", () => {
    const result = extractQuery(";;", ";;");
    expect(result).toBeNull();
  });

  it("works with custom prefix", () => {
    const result = extractQuery("??How does this work?", "??");
    expect(result).toBe("How does this work?");
  });

  it("returns null for whitespace-only query after prefix", () => {
    const result = extractQuery(";;   ", ";;");
    expect(result).toBeNull();
  });

  it("returns null when prefix appears mid-line", () => {
    const result = extractQuery("some text ;; question", ";;");
    expect(result).toBeNull();
  });

  it("returns null for empty string input", () => {
    const result = extractQuery("", ";;");
    expect(result).toBeNull();
  });

  it("returns null for partial prefix match", () => {
    const result = extractQuery(";not enough", ";;");
    expect(result).toBeNull();
  });
});

describe("findTrigger", () => {
  it("returns trigger when cursor is on a trigger line", () => {
    const editor = mockEditor([";;What is this?", "other line"], 0);
    const result = findTrigger(editor, ";;");
    expect(result).toEqual({ query: "What is this?", lineNumber: 0 });
  });

  it("returns null when cursor is not on a trigger line", () => {
    const editor = mockEditor(["no trigger", ";;query"], 0);
    expect(findTrigger(editor, ";;")).toBeNull();
  });
});

describe("getDocumentWithoutTriggerLine", () => {
  it("removes the trigger line and joins the rest", () => {
    const editor = mockEditor(["line 0", ";;trigger", "line 2"]);
    expect(getDocumentWithoutTriggerLine(editor, 1)).toBe("line 0\nline 2");
  });

  it("handles trigger on first line", () => {
    const editor = mockEditor([";;trigger", "line 1"]);
    expect(getDocumentWithoutTriggerLine(editor, 0)).toBe("line 1");
  });

  it("handles trigger on last line", () => {
    const editor = mockEditor(["line 0", ";;trigger"]);
    expect(getDocumentWithoutTriggerLine(editor, 1)).toBe("line 0");
  });

  it("handles single-line document", () => {
    const editor = mockEditor([";;trigger"]);
    expect(getDocumentWithoutTriggerLine(editor, 0)).toBe("");
  });
});

describe("getDocumentContext", () => {
  it("inserts cursor marker at trigger line", () => {
    const editor = mockEditor(["line 0", ";;question", "line 2"]);
    const result = getDocumentContext(editor, 1);
    expect(result).toBe("line 0\n<<< CURSOR >>>\nline 2");
  });

  it("handles trigger on first line", () => {
    const editor = mockEditor([";;question", "line 1"]);
    const result = getDocumentContext(editor, 0);
    expect(result).toBe("<<< CURSOR >>>\nline 1");
  });

  it("handles trigger on last line", () => {
    const editor = mockEditor(["line 0", ";;question"]);
    const result = getDocumentContext(editor, 1);
    expect(result).toBe("line 0\n<<< CURSOR >>>");
  });
});

