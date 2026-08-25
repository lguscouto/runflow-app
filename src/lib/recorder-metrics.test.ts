import { describe, expect, it } from "vitest";
import { accumulatePositiveElevationGain } from "./recorder-metrics";

describe("recorder metrics", () => {
  it("counts each positive elevation segment only once", () => {
    const points = [
      { elevation: 100 },
      { elevation: 110 },
    ];

    const first = accumulatePositiveElevationGain(points, 0, false);
    const repeated = accumulatePositiveElevationGain(points, first.nextPointCount, false);
    const appended = accumulatePositiveElevationGain(
      [...points, { elevation: 115 }],
      repeated.nextPointCount,
      false
    );

    expect(first).toEqual({ deltaM: 10, nextPointCount: 2 });
    expect(repeated).toEqual({ deltaM: 0, nextPointCount: 2 });
    expect(appended).toEqual({ deltaM: 5, nextPointCount: 3 });
  });

  it("does not count elevation across an auto-paused boundary", () => {
    const points = [
      { elevation: 100 },
      { elevation: 500, autoPaused: true },
      { elevation: 510 },
      { elevation: 520 },
    ];

    expect(accumulatePositiveElevationGain(points, 0, false).deltaM).toBe(10);
  });
});