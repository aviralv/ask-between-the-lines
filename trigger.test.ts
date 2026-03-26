import { describe, it, expect } from "vitest";
import { extractQuery } from "./trigger";

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
});
