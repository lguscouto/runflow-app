"use client";

import { Moon, Sun } from "lucide-react";
import { useAppTheme } from "./ThemeProvider";

interface ThemeToggleProps {
  lightLabel: string;
  darkLabel: string;
}

export function ThemeToggle({ lightLabel, darkLabel }: ThemeToggleProps) {
  const { theme, toggleTheme } = useAppTheme();
  const nextLabel = theme === "dark" ? lightLabel : darkLabel;

  return (
    <button
      type="button"
      className="theme-toggle touch-target gap-2 px-2.5 rounded-lg text-sm font-semibold transition-colors"
      aria-label={nextLabel}
      aria-pressed={theme === "light"}
      title={nextLabel}
      onClick={toggleTheme}
    >
      {theme === "dark" ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
      <span className="hidden lg:inline">{nextLabel}</span>
    </button>
  );
}
