import { colorTokens } from "./color-tokens";

export interface ContrastPair {
  name: string;
  foreground: string;
  background: string;
  minimum?: number;
}

function normalizeHex(value: string): string {
  const hex = value.trim().replace(/^#/, "");
  if (hex.length === 3) {
    return hex
      .split("")
      .map((channel) => channel + channel)
      .join("");
  }
  if (hex.length === 6) return hex;
  throw new Error(`Unsupported color format: ${value}`);
}

function relativeLuminance(value: string): number {
  const hex = normalizeHex(value);
  const channels = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

export function auditContrast(pairs: readonly ContrastPair[]): string[] {
  return pairs.flatMap((pair) => {
    const ratio = contrastRatio(pair.foreground, pair.background);
    const minimum = pair.minimum ?? 4.5;
    return ratio >= minimum
      ? []
      : [`${pair.name}: ${ratio}:1 (mínimo ${minimum}:1)`];
  });
}

export const ACCESSIBILITY_CONTRAST_PAIRS: readonly ContrastPair[] = [
  {
    name: "dark body text",
    foreground: colorTokens.content.primary,
    background: colorTokens.surface.app,
  },
  {
    name: "dark muted text",
    foreground: colorTokens.content.muted,
    background: colorTokens.surface.app,
  },
  {
    name: "dark accent text",
    foreground: colorTokens.brand.accent,
    background: colorTokens.surface.app,
  },
  {
    name: "dark accent action",
    foreground: colorTokens.content.onAccent,
    background: colorTokens.brand.accent,
  },
  {
    name: "light body text",
    foreground: colorTokens.lightMode.text,
    background: colorTokens.lightMode.background,
  },
  {
    name: "light muted text",
    foreground: colorTokens.lightMode.muted,
    background: colorTokens.lightMode.background,
  },
  {
    name: "light accent text",
    foreground: colorTokens.lightMode.accent,
    background: colorTokens.lightMode.background,
  },
  {
    name: "light chart pace text",
    foreground: colorTokens.lightMode.chartPace,
    background: colorTokens.lightMode.background,
  },
  {
    name: "light accent action",
    foreground: colorTokens.lightMode.onAccent,
    background: colorTokens.lightMode.accent,
  },
  {
    name: "light success text",
    foreground: colorTokens.lightMode.success,
    background: colorTokens.lightMode.background,
  },
  {
    name: "light danger status",
    foreground: colorTokens.lightMode.danger,
    background: colorTokens.lightMode.background,
  },
  {
    name: "HC climb badge",
    foreground: "#ffffff",
    background: colorTokens.climbCategories.hc,
  },
  {
    name: "Cat 1 climb badge",
    foreground: "#ffffff",
    background: colorTokens.climbCategories.cat1,
  },
  {
    name: "Cat 2 climb badge",
    foreground: "#000000",
    background: colorTokens.climbCategories.cat2,
  },
  {
    name: "Cat 3 climb badge",
    foreground: "#000000",
    background: colorTokens.climbCategories.cat3,
  },
  {
    name: "Cat 4 climb badge",
    foreground: "#000000",
    background: colorTokens.climbCategories.cat4,
  },
  {
    name: "uncategorized climb badge",
    foreground: "#ffffff",
    background: colorTokens.climbCategories.uncategorized,
  },
];
