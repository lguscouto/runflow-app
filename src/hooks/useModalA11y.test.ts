import { describe, it, expect } from "vitest";
import { useModalA11y } from "./useModalA11y";

describe("useModalA11y Hook", () => {
  it("exports useModalA11y function", () => {
    expect(typeof useModalA11y).toBe("function");
  });
});
