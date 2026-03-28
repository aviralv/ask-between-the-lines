import { buildPrompt, getSystemPrompt, buildUserMessage, stripAiCallouts } from "./prompt";

describe("getSystemPrompt", () => {
  it("contains the conciseness instruction", () => {
    const result = getSystemPrompt();
    expect(result).toContain("concise");
  });

  it("contains the behavioral instruction", () => {
    const result = getSystemPrompt();
    expect(result).toContain("inline assistant");
  });

  it("contains cursor/selection marker guidance", () => {
    const result = getSystemPrompt();
    expect(result).toContain("CURSOR");
    expect(result).toContain("SELECTION");
  });

  it("does not contain document markers", () => {
    const result = getSystemPrompt();
    expect(result).not.toContain("--- DOCUMENT ---");
    expect(result).not.toContain("--- END DOCUMENT ---");
  });
});

describe("buildUserMessage", () => {
  it("includes document and query", () => {
    const result = buildUserMessage("# My doc\nSome content", "What is this?");
    expect(result).toContain("# My doc\nSome content");
    expect(result).toContain("What is this?");
    expect(result).toContain("--- DOCUMENT ---");
    expect(result).toContain("--- END DOCUMENT ---");
  });

  it("handles documents with curly braces", () => {
    const doc = '```json\n{"key": "value"}\n```';
    const result = buildUserMessage(doc, "Explain this");
    expect(result).toContain('{"key": "value"}');
  });

  it("does not contain the system instruction", () => {
    const result = buildUserMessage("doc", "query");
    expect(result).not.toContain("inline assistant");
    expect(result).not.toContain("concise");
  });
});

describe("buildPrompt", () => {
  it("includes document and query in prompt", () => {
    const result = buildPrompt("# My doc\nSome content", "What is this?");
    expect(result).toContain("# My doc\nSome content");
    expect(result).toContain("What is this?");
    expect(result).toContain("--- DOCUMENT ---");
    expect(result).toContain("--- END DOCUMENT ---");
  });

  it("handles documents with curly braces", () => {
    const doc = '```json\n{"key": "value"}\n```';
    const result = buildPrompt(doc, "Explain this");
    expect(result).toContain('{"key": "value"}');
  });

  it("includes conciseness instruction", () => {
    const result = buildPrompt("doc", "query");
    expect(result).toContain("concise");
  });
});

describe("stripAiCallouts", () => {
  it("strips a single [!ai] callout block", () => {
    const doc = "Line before\n> [!ai]- Some query\n> Response line 1\n> Response line 2\nLine after";
    const result = stripAiCallouts(doc);
    expect(result).toBe("Line before\nLine after");
  });

  it("strips [!ai] callout without collapsible marker", () => {
    const doc = "Before\n> [!ai] Thinking... (query)\nAfter";
    const result = stripAiCallouts(doc);
    expect(result).toBe("Before\nAfter");
  });

  it("strips [!error] callout blocks", () => {
    const doc = "Before\n> [!error]- Ask failed\n> Some error message\nAfter";
    const result = stripAiCallouts(doc);
    expect(result).toBe("Before\nAfter");
  });

  it("preserves other callout types", () => {
    const doc = "Before\n> [!note] Important\n> Keep this content\nAfter";
    const result = stripAiCallouts(doc);
    expect(result).toBe("Before\n> [!note] Important\n> Keep this content\nAfter");
  });

  it("strips multiple AI callouts in one document", () => {
    const doc = "Intro\n> [!ai]- Q1\n> A1\nMiddle\n> [!ai]- Q2\n> A2\nEnd";
    const result = stripAiCallouts(doc);
    expect(result).toBe("Intro\nMiddle\nEnd");
  });

  it("handles back-to-back AI callouts", () => {
    const doc = "> [!ai]- Q1\n> A1\n> [!ai]- Q2\n> A2\nAfter";
    const result = stripAiCallouts(doc);
    expect(result).toBe("After");
  });

  it("handles callout with metadata footer", () => {
    const doc = "Before\n> [!ai]- Query\n> Answer text\n>\n> *523 in · 47 out · 3.2s*\nAfter";
    const result = stripAiCallouts(doc);
    expect(result).toBe("Before\nAfter");
  });

  it("returns document unchanged when no AI callouts present", () => {
    const doc = "Just normal text\nWith multiple lines";
    const result = stripAiCallouts(doc);
    expect(result).toBe(doc);
  });

  it("handles empty document", () => {
    expect(stripAiCallouts("")).toBe("");
  });
});
