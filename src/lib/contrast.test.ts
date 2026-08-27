import { describe, expect, it } from "vitest";
import {
  ACCESSIBILITY_CONTRAST_PAIRS,
  auditContrast,
  contrastRatio,
} from "./contrast";
import { getCategoryBadgeStyle } from "./climb-detection";

describe("contrast audit", () => {
  it("keeps essential light and dark theme pairs at WCAG AA", () => {
    const findings = auditContrast(ACCESSIBILITY_CONTRAST_PAIRS);

    expect(findings).toEqual([]);
  });

  it("calculates the WCAG contrast ratio correctly", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBe(21);
    expect(contrastRatio("#ffffff", "#c2410c")).toBeGreaterThanOrEqual(4.5);
  });

  it("selects a readable foreground for every climb badge", () => {
    expect(getCategoryBadgeStyle("HC").badgeText).toBe("#ffffff");
    expect(getCategoryBadgeStyle("Cat 1").badgeText).toBe("#ffffff");
    expect(getCategoryBadgeStyle("Cat 2").badgeText).toBe("#000000");
    expect(getCategoryBadgeStyle("Cat 3").badgeText).toBe("#000000");
    expect(getCategoryBadgeStyle("Cat 4").badgeText).toBe("#000000");
    expect(getCategoryBadgeStyle("Uncategorized").badgeText).toBe("#ffffff");
  });
});
