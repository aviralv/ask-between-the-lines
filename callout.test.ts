import { describe, it, expect } from "vitest";
import { formatResponseCallout } from "./callout";

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
