import { describe, expect, it, vi } from "vitest";

vi.mock("fit-file-parser", () => ({
  default: class FakeFitParser {
    private readonly options: Record<string, unknown>;

    constructor(options: Record<string, unknown>) {
      this.options = options;
    }

    parse(_buffer: Buffer, callback: (error: Error | null, data: Record<string, unknown>) => void) {
      const speed = this.options.speedUnit === "km/h" ? 36 : 10;
      callback(null, {
        records: [
          { position_lat: Number.MAX_VALUE, position_long: -43.2, altitude: 100 },
          {
            position_lat: -22.9,
            position_long: -43.2,
            altitude: Number.POSITIVE_INFINITY,
            timestamp: Number.POSITIVE_INFINITY,
          },
          {
            position_lat: -22.8999,
            position_long: -43.2,
            altitude: 101,
            timestamp: new Date("2026-08-25T00:00:01Z"),
            power: -20,
            heart_rate: 999,
            cadence: 999,
            speed,
          },
        ],
        sessions: [{
          start_time: new Date("2026-08-25T00:00:00Z"),
          avg_heart_rate: 999,
          max_heart_rate: 999,
          avg_speed: speed,
          max_speed: speed,
          avg_power: 99999,
          max_power: 99999,
          normalized_power: 99999,
          avg_cadence: 999,
          max_cadence: 999,
          total_calories: -1,
          total_ascent: -1,
        }],
      });
    }
  },
}));

import { parseFit } from "./fit";

describe("FIT numeric safety", () => {
  it("filters invalid converted coordinates and non-finite telemetry", async () => {
    const parsed = await parseFit(new ArrayBuffer(0), "activity.fit");

    expect(parsed.points).toHaveLength(2);
    expect(parsed.points[0]).toMatchObject({ lat: -22.9, lng: -43.2 });
    expect(parsed.points[0].elevation).toBeUndefined();
    expect(parsed.points[0].timestamp).toBeUndefined();
    expect(parsed.points[1].timestamp).toEqual(new Date("2026-08-25T00:00:01Z"));
    expect(parsed.points[1].watts).toBeUndefined();
    expect(parsed.points[1].hr).toBeUndefined();
    expect(parsed.points[1].cadence).toBeUndefined();
    expect(parsed.points[1].speedKmh).toBe(36);
    expect(parsed.avgHr).toBeUndefined();
    expect(parsed.maxHr).toBeUndefined();
    expect(parsed.avgSpeedKmh).toBe(36);
    expect(parsed.maxSpeedKmh).toBe(36);
    expect(parsed.avgWatts).toBeUndefined();
    expect(parsed.maxWatts).toBeUndefined();
    expect(parsed.normalizedPowerWatts).toBeUndefined();
    expect(parsed.avgCadenceRpm).toBeUndefined();
    expect(parsed.maxCadenceRpm).toBeUndefined();
    expect(parsed.calories).toBeUndefined();
    expect(parsed.elevationGainM).toBe(0);
    expect(parsed.startedAt).toEqual(new Date("2026-08-25T00:00:00Z"));
  });
});