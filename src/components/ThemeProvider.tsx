"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  applyAppTheme,
  DEFAULT_APP_THEME,
  readStoredTheme,
  getBrowserStorage,
  THEME_STORAGE_KEY,
  type AppTheme,
} from "@/lib/theme";
import { colorTokens } from "@/lib/color-tokens";

interface ThemeContextValue {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyBrowserTheme(theme: AppTheme) {
  applyAppTheme(theme, document.documentElement);
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute(
      "content",
      theme === "light" ? colorTokens.lightMode.background : colorTokens.surface.app,
    );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_APP_THEME);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storedTheme = readStoredTheme(getBrowserStorage());
    setTheme(storedTheme);
    applyBrowserTheme(storedTheme);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    applyBrowserTheme(theme);
    try {
      getBrowserStorage()?.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // A blocked storage should not prevent the theme from working in memory.
    }
  }, [hydrated, theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within ThemeProvider");
  }
  return context;
}
