/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_APP_THEME,
  THEME_STORAGE_KEY,
  applyAppTheme,
  getBrowserStorage,
  isAppTheme,
  readStoredTheme,
} from "./theme";

describe("app theme", () => {
  it("accepts only supported themes and falls back to dark", () => {
    expect(isAppTheme("dark")).toBe(true);
    expect(isAppTheme("light")).toBe(true);
    expect(isAppTheme("system")).toBe(false);
    expect(isAppTheme(null)).toBe(false);
    expect(DEFAULT_APP_THEME).toBe("dark");
  });

  it("reads a valid stored preference without trusting invalid values", () => {
    const getItem = vi.fn((key: string) =>
      key === THEME_STORAGE_KEY ? "light" : null,
    );
    const storage = { getItem } as Pick<Storage, "getItem">;

    expect(readStoredTheme(storage)).toBe("light");
    expect(getItem).toHaveBeenCalledWith(THEME_STORAGE_KEY);
    expect(
      readStoredTheme({ getItem: () => "not-a-theme" } as Pick<Storage, "getItem">),
    ).toBe(DEFAULT_APP_THEME);
  });

  it("does not fail when storage is unavailable", () => {
    expect(
      readStoredTheme({
        getItem: () => {
          throw new Error("storage blocked");
        },
      } as Pick<Storage, "getItem">),
    ).toBe(DEFAULT_APP_THEME);
  });

  it("does not fail when the browser localStorage getter throws", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => {
        throw new Error("storage blocked");
      },
    });

    expect(getBrowserStorage()).toBeUndefined();

    if (original) Object.defineProperty(window, "localStorage", original);
  });

  it("applies the theme to the document root", () => {
    const root = { dataset: {}, style: {} } as unknown as HTMLElement;

    applyAppTheme("light", root);

    expect(root.dataset.theme).toBe("light");
    expect(root.style.colorScheme).toBe("light");
  });
});
