import { buildPrompt, getSystemPrompt, buildUserMessage } from "./prompt";

describe("getSystemPrompt", () => {
  it("contains the conciseness instruction", () => {
    const result = getSystemPrompt();
    expect(result).toContain("concise");
  });

  it("contains the behavioral instruction", () => {
    const result = getSystemPrompt();
    expect(result).toContain("inline assistant");
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
