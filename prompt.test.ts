import { buildPrompt } from "./prompt";

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
