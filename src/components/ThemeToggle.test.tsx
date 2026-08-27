/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "./ThemeProvider";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
    document.head.querySelector('meta[name="theme-color"]')?.remove();
  });

  it("exposes the next theme and persists the user choice", async () => {
    const themeColorMeta = document.createElement("meta");
    themeColorMeta.name = "theme-color";
    document.head.appendChild(themeColorMeta);

    render(
      <ThemeProvider>
        <ThemeToggle lightLabel="Ativar modo claro" darkLabel="Ativar modo escuro" />
      </ThemeProvider>,
    );

    const toggle = screen.getByRole("button");
    await waitFor(() => {
      expect(toggle.getAttribute("aria-label")).toBe("Ativar modo claro");
      expect(toggle.getAttribute("aria-pressed")).toBe("false");
    });

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(toggle.getAttribute("aria-label")).toBe("Ativar modo escuro");
      expect(toggle.getAttribute("aria-pressed")).toBe("true");
      expect(document.documentElement.dataset.theme).toBe("light");
      expect(window.localStorage.getItem("runflow_theme")).toBe("light");
      expect(themeColorMeta.content).toBe("#ffffff");
    });
  });

  it("restores a valid preference on mount", async () => {
    window.localStorage.setItem("runflow_theme", "light");

    render(
      <ThemeProvider>
        <ThemeToggle lightLabel="Ativar modo claro" darkLabel="Ativar modo escuro" />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button").getAttribute("aria-label")).toBe("Ativar modo escuro");
      expect(document.documentElement.dataset.theme).toBe("light");
    });
  });
});
