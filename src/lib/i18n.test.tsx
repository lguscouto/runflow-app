/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider, useI18n, type Language } from "./i18n";

const mocks = vi.hoisted(() => ({
  getNativeAppLocale: vi.fn(),
  setNativeAppLocale: vi.fn(),
  getUserProfile: vi.fn(),
  saveUserProfile: vi.fn(),
}));

vi.mock("@/lib/app-locale", () => ({
  getNativeAppLocale: mocks.getNativeAppLocale,
  setNativeAppLocale: mocks.setNativeAppLocale,
}));
vi.mock("@/lib/profile", () => ({
  getUserProfile: mocks.getUserProfile,
  saveUserProfile: mocks.saveUserProfile,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

function LanguageProbe() {
  const { language, t, changeLanguage } = useI18n();
  return (
    <>
      <span data-testid="language">{language}</span>
      <span data-testid="home-label">{t("nav.home")}</span>
      <button type="button" onClick={() => void changeLanguage("en")}>English</button>
      <button type="button" onClick={() => void changeLanguage("fr" as unknown as Language)}>
        Invalid
      </button>
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.setNativeAppLocale.mockResolvedValue(undefined);
  mocks.getUserProfile.mockResolvedValue(null);
  mocks.saveUserProfile.mockResolvedValue(undefined);
});

describe("I18nProvider initial preference race", () => {
  it("does not let a stale initial locale overwrite a later user choice", async () => {
    const nativeLocale = deferred<string | null>();
    mocks.getNativeAppLocale.mockReturnValue(nativeLocale.promise);

    render(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByTestId("language").textContent).toBe("en");

    nativeLocale.resolve("pt-BR");
    await waitFor(() => expect(mocks.saveUserProfile).toHaveBeenCalled());
    expect(screen.getByTestId("language").textContent).toBe("en");
  });

  it("falls back safely when an imported profile contains an unsupported language", async () => {
    mocks.getNativeAppLocale.mockResolvedValue(null);
    mocks.getUserProfile.mockResolvedValue({ language: "fr", updatedAt: "2026-08-25T12:00:00.000Z" });
    Object.defineProperty(navigator, "language", { configurable: true, value: "pt-BR" });

    render(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("home-label").textContent).toBe("Início"));
    expect(screen.getByTestId("language").textContent).toBe("pt");
  });

  it("rejects an unsupported runtime language before changing or persisting it", async () => {
    mocks.getNativeAppLocale.mockResolvedValue(null);

    render(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("language").textContent).toBe("pt"));

    fireEvent.click(screen.getByRole("button", { name: "Invalid" }));

    expect(screen.getByTestId("language").textContent).toBe("pt");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.saveUserProfile).not.toHaveBeenCalled();
  });
});
