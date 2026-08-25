/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildRecordedActivity } from "./record-workout";
import { saveActivity } from "./activities";
import { getAllStoredGear, putActivity } from "./storage";

vi.mock("./storage", async () => {
  const actual = await vi.importActual<typeof import("./storage")>("./storage");
  return {
    ...actual,
    getAllStoredGear: vi.fn(),
    putActivity: vi.fn(),
  };
});

vi.mock("./profile", async () => {
  const actual = await vi.importActual<typeof import("./profile")>("./profile");
  return {
    ...actual,
    getUserProfile: vi.fn().mockResolvedValue(null),
  };
});

const point = (lng: number, seconds: number, elevation: number, autoPaused = false) => ({
  lat: -22.9,
  lng,
  elevation,
  timestamp: new Date(seconds * 1000),
  autoPaused,
});

describe("saveActivity cycling segment boundaries", () => {
  beforeEach(() => {
    vi.mocked(getAllStoredGear).mockResolvedValue([]);
    vi.mocked(putActivity).mockReset();
  });

  it("does not bridge persisted cycling metrics across an auto-paused gap", async () => {
    const parsed = buildRecordedActivity(
      "cycling",
      new Date(0),
      new Date(10_000),
      [
        point(-43.2, 0, 100),
        point(-43.199, 1, 100),
        point(-43.19, 2, 500, true),
        point(-43.1899, 3, 500),
        point(-43.1898, 4, 500),
      ],
      10
    );
    parsed.calories = 100;

    await saveActivity(parsed, "synthetic-test");

    const stored = vi.mocked(putActivity).mock.calls[0]?.[0];
    expect(stored).toBeDefined();
    expect(stored?.avgSpeedKmh).toBeLessThan(100);
    expect(stored?.points[0]?.watts).toBeUndefined();
    expect(stored?.points[1]?.watts).toBeGreaterThan(0);
    expect(stored?.points[2]?.watts).toBeUndefined();
    expect(stored?.points[3]?.watts).toBeGreaterThan(0);
    expect(stored?.trackSegments).toHaveLength(2);
    expect(stored?.trackSegments?.[0]).toHaveLength(2);
    expect(stored?.trackSegments?.[1]).toHaveLength(2);
  });
});
