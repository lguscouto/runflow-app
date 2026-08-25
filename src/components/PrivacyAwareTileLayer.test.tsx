// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const leaflet = vi.hoisted(() => {
  let controlElement: HTMLElement | null = null;
  class Control {
    onAdd?: () => HTMLElement;

    addTo() {
        controlElement = this.onAdd?.() ?? null;
        if (controlElement) document.body.appendChild(controlElement);
        return this;
    }

    remove() {
      controlElement?.remove();
      controlElement = null;
    }
  }

  return {
    Control,
    create: vi.fn((tag: string, className?: string, parent?: HTMLElement) => {
      const element = document.createElement(tag);
      if (className) element.className = className;
      parent?.appendChild(element);
      return element;
    }),
  };
});

vi.mock("leaflet", () => ({
  Control: leaflet.Control,
  DomUtil: { create: leaflet.create },
  DomEvent: { disableClickPropagation: vi.fn() },
}));

vi.mock("react-leaflet", () => ({
  TileLayer: ({ url }: { url: string }) => <div data-testid="tile-layer">{url}</div>,
  useMap: () => ({}),
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      key === "map.load_online_tiles"
        ? "Carregar mapa online"
        : "O provedor receberá a área visualizada.",
  }),
}));

import { PrivacyAwareTileLayer } from "./PrivacyAwareTileLayer";

describe("PrivacyAwareTileLayer", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("does not request external tiles until the user explicitly consents for the session", () => {
    render(
      <PrivacyAwareTileLayer
        provider="OpenStreetMap"
        url="https://tiles.example/{z}/{x}/{y}.png"
      />,
    );

    expect(screen.queryByTestId("tile-layer")).toBeNull();
    const consent = screen.getByRole("button", { name: "Carregar mapa online" });
    expect(consent.getAttribute("title")).toContain("área visualizada");

    fireEvent.click(consent);

    expect(screen.getByTestId("tile-layer").textContent).toContain("tiles.example");
    expect(window.sessionStorage.getItem("runflow:external-map-tiles-consent")).toBe("granted");
  });

  it("keeps external tiles blocked when session consent cannot be persisted", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    render(
      <PrivacyAwareTileLayer
        provider="OpenStreetMap"
        url="https://tiles.example/{z}/{x}/{y}.png"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Carregar mapa online" }));

    expect(screen.queryByTestId("tile-layer")).toBeNull();
    expect(setItem).toHaveBeenCalledWith("runflow:external-map-tiles-consent", "granted");
    setItem.mockRestore();
  });
});
