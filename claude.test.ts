import { describe, it, expect } from "vitest";
import { parseClaudeOutput } from "./claude";

describe("parseClaudeOutput", () => {
  it("parses valid JSON response with usage metadata", () => {
    const json = JSON.stringify({
      type: "result",
      result: "The answer is 42",
      usage: { input_tokens: 100, output_tokens: 20 },
      duration_ms: 3500,
    });

    const result = parseClaudeOutput(json);
    expect(result.ok).toBe(true);
    expect(result.text).toBe("The answer is 42");
    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(20);
    expect(result.durationMs).toBe(3500);
  });

  it("returns error for invalid JSON", () => {
    const result = parseClaudeOutput("not json");
    expect(result.ok).toBe(false);
    expect(result.text).toContain("Failed to parse");
  });

  it("handles missing usage fields gracefully", () => {
    const json = JSON.stringify({
      type: "result",
      result: "response",
    });

    const result = parseClaudeOutput(json);
    expect(result.ok).toBe(true);
    expect(result.text).toBe("response");
    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
    expect(result.durationMs).toBe(0);
  });
});

describe("parseClaudeOutput with sessionId", () => {
  it("extracts session_id from JSON response", () => {
    const json = JSON.stringify({
      type: "result",
      result: "The answer",
      session_id: "ABC-123-DEF",
      usage: { input_tokens: 100, output_tokens: 20 },
      duration_ms: 2000,
    });

    const result = parseClaudeOutput(json);
    expect(result.ok).toBe(true);
    expect(result.sessionId).toBe("ABC-123-DEF");
  });

  it("returns empty sessionId when not present", () => {
    const json = JSON.stringify({
      type: "result",
      result: "response",
    });

    const result = parseClaudeOutput(json);
    expect(result.sessionId).toBe("");
  });

  it("returns empty sessionId on parse failure", () => {
    const result = parseClaudeOutput("not json");
    expect(result.sessionId).toBe("");
  });
});
