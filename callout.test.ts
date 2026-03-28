import { describe, it, expect } from "vitest";
import {
  formatResponseCallout,
  formatThinkingCallout,
} from "./callout";

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
