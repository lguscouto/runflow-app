import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { colorTokens } from "./color-tokens";

const COLOR_VALUE = /^(#[0-9a-f]{3,8}|rgba?\([^)]*\))$/i;

function collectColorValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectColorValues);
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectColorValues);
  }
  return [];
}

describe("colorTokens", () => {
  it("mantém todas as cores em formatos consumíveis pelo browser e Canvas", () => {
    const values = collectColorValues(colorTokens);

    expect(values.length).toBeGreaterThan(50);
    expect(values.every((value) => COLOR_VALUE.test(value))).toBe(true);
  });

  it("expõe os papéis visuais essenciais do produto", () => {
    expect(colorTokens.brand.accent).toBe(colorTokens.chart.pace);
    expect(colorTokens.map.track).toBe(colorTokens.brand.accent);
    expect(colorTokens.status.warning).toBe(colorTokens.chart.power);
    expect(colorTokens.content.inverse).toBe("#ffffff");
  });

  it("mantém os aliases CSS compartilhados sincronizados", () => {
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    const aliases = [
      ["color-brand-accent", colorTokens.brand.accent],
      ["color-surface-app", colorTokens.surface.app],
      ["color-surface-panel", colorTokens.surface.panel],
      ["color-content-primary", colorTokens.content.primary],
      ["color-chart-pace", colorTokens.chart.pace],
      ["color-status-danger", colorTokens.status.danger],
    ] as const;

    for (const [name, value] of aliases) {
      expect(css).toContain(`--${name}: ${value};`);
    }
  });
});
