/** @vitest-environment jsdom */
import { render } from "@testing-library/react";
import L from "leaflet";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MapTrack } from "./MapTrack";

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key, language: "pt" }),
}));

const points = [
  { lat: -23.55, lng: -46.63 },
  { lat: -23.551, lng: -46.631 },
  { lat: -23.552, lng: -46.632 },
];

describe("Leaflet map lifecycle", () => {
  let removeSpy: ReturnType<typeof vi.spyOn>;
  const cleanupSnapshots: Array<{ layers: number; events: number }> = [];

  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get: () => 640,
    });
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get: () => 360,
    });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 640,
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => 360,
    });

    const originalRemove = L.Map.prototype.remove;
    removeSpy = vi.spyOn(L.Map.prototype, "remove").mockImplementation(function (this: L.Map) {
      const result = originalRemove.call(this);
      cleanupSnapshots.push({
        layers: Object.keys((this as unknown as { _layers?: object })._layers ?? {}).length,
        events: Object.keys((this as unknown as { _events?: object })._events ?? {}).length,
      });
      return result;
    });
  });

  afterAll(() => {
    removeSpy.mockRestore();
  });

  it("removes Leaflet maps, layers and listeners across repeated mount cycles", () => {
    for (let cycle = 0; cycle < 20; cycle += 1) {
      const view = render(<MapTrack points={points} />);
      expect(document.querySelectorAll(".leaflet-container")).toHaveLength(1);
      view.unmount();
      expect(document.querySelectorAll(".leaflet-container")).toHaveLength(0);
    }

    expect(removeSpy).toHaveBeenCalledTimes(20);
    expect(cleanupSnapshots).toHaveLength(20);
    expect(cleanupSnapshots.every((snapshot) => snapshot.layers === 0)).toBe(true);
    expect(
      cleanupSnapshots.every((snapshot) => snapshot.events === cleanupSnapshots[0].events),
    ).toBe(true);
  });
});
