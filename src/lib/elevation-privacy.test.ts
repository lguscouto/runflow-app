// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./storage", () => ({
  getStoredActivity: vi.fn(),
  putActivity: vi.fn(),
}));

import { enrichActivityElevationWithRetry } from "./enrichment";
import { enrichActivityElevation } from "./elevation";
import { enrichRouteWithElevation } from "./climb-detection";
import { getStoredActivity } from "./storage";

const activity = {
  id: "synthetic-privacy-activity",
  points: [
    { lat: -23.5, lng: -46.6 },
    { lat: -23.51, lng: -46.61 },
  ],
};

describe("activity elevation privacy boundary", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.clearAllMocks();
    vi.mocked(getStoredActivity).mockResolvedValue(activity as never);
  });

  it("blocks the legacy activity enrichment before fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(enrichActivityElevation(activity.id)).rejects.toThrow(
      "External elevation consent required",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("blocks the retrying activity enrichment before fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(enrichActivityElevationWithRetry(activity.id)).rejects.toThrow(
      "External elevation consent required",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("blocks route enrichment before fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const routePoints = activity.points.map(({ lat, lng }) => ({ lat, lng }));

    await expect(enrichRouteWithElevation(routePoints)).rejects.toThrow(
      "External elevation consent required",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
