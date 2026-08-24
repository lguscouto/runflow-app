import { describe, it, expect } from "vitest";
import { getNativeAppLocale, setNativeAppLocale } from "./app-locale";

describe("App Locale Bridge", () => {
  it("handles getNativeAppLocale gracefully", async () => {
    const locale = await getNativeAppLocale();
    expect(locale === null || typeof locale === "string").toBe(true);
  });

  it("handles setNativeAppLocale gracefully", async () => {
    const success = await setNativeAppLocale("pt-BR");
    expect(typeof success).toBe("boolean");
  });
});
