export type AppTheme = "dark" | "light";

export const DEFAULT_APP_THEME: AppTheme = "dark";
export const THEME_STORAGE_KEY = "runflow_theme";

export function getBrowserStorage(): Pick<Storage, "getItem" | "setItem"> | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function isAppTheme(value: unknown): value is AppTheme {
  return value === "dark" || value === "light";
}

export function readStoredTheme(
  storage?: Pick<Storage, "getItem">,
): AppTheme {
  try {
    const stored = storage?.getItem(THEME_STORAGE_KEY);
    return isAppTheme(stored) ? stored : DEFAULT_APP_THEME;
  } catch {
    return DEFAULT_APP_THEME;
  }
}

export function applyAppTheme(theme: AppTheme, root: HTMLElement): void {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}
