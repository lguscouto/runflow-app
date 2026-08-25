import { describe, expect, it } from "vitest";
import {
  acceptGpsReading,
  buildRecordedActivity,
  shouldAcceptPoint,
  validateRecordedWorkout,
} from "./record-workout";

const point = (lat: number, lng: number, seconds: number, autoPaused = false) => ({
  lat,
  lng,
  timestamp: new Date(seconds * 1000),
  autoPaused,
});

describe("recorded workout safety", () => {
  it("rejects non-finite coordinates and invalid timestamps", () => {
    expect(shouldAcceptPoint([], point(Number.NaN, -43.2, 1))).toBe(false);
    expect(shouldAcceptPoint([], point(-22.9, Number.POSITIVE_INFINITY, 1))).toBe(false);

    const invalidTimestamp = {
      ...point(-22.9, -43.2, 1),
      timestamp: new Date(Number.NaN),
    };
    expect(shouldAcceptPoint([], invalidTimestamp)).toBe(false);
    expect(
      shouldAcceptPoint([], {
        ...point(-22.9, -43.2, 1),
        timestamp: "not-a-date",
      } as never)
    ).toBe(false);
    expect(
      shouldAcceptPoint([], {
        ...point(-22.9, -43.2, 1),
        elevation: Number.NaN,
      })
    ).toBe(false);
    expect(shouldAcceptPoint([], point(91, -43.2, 1))).toBe(false);
    expect(shouldAcceptPoint([], point(-22.9, -181, 1))).toBe(false);
    expect(acceptGpsReading(-1)).toBe(false);
    expect(acceptGpsReading(Number.NaN)).toBe(false);
  });

  it("accepts a stationary point while auto-pause is active to persist the boundary", () => {
    const previous = point(-22.9, -43.2, 1);
    const pausedPoint = { ...point(-22.9, -43.2, 2, true), elevation: 100 };

    expect(shouldAcceptPoint([previous], pausedPoint)).toBe(true);
  });

  it("keeps sub-threshold stationary fixes for auto-pause detection without distance", () => {
    const points = [
      point(-22.90000, -43.20000, 0),
      point(-22.90001, -43.20000, 1),
      point(-22.90002, -43.20000, 2),
    ];

    expect(shouldAcceptPoint([points[0]], points[1], "running", { allowStationary: true })).toBe(true);
    expect(shouldAcceptPoint(points.slice(0, 2), points[2], "running", { allowStationary: true })).toBe(true);
    expect(buildRecordedActivity("running", new Date(0), new Date(2_000), points).distanceM).toBe(0);
  });

  it("excludes auto-paused segments from validation and persisted activity", () => {
    const points = [
      point(-22.9000, -43.2000, 0),
      point(-22.9000, -43.20005, 10),
      point(-22.9000, -43.2010, 20, true),
      point(-22.9000, -43.2020, 30, true),
      point(-22.9000, -43.20010, 40),
    ];

    expect(validateRecordedWorkout(points, 40)).toBe("Distância muito curta (mínimo 20 metros).");

    const activity = buildRecordedActivity(
      "running",
      new Date(0),
      new Date(40_000),
      points,
      20
    );

    expect(activity.points).toHaveLength(3);
    expect(activity.points.every((savedPoint) => !savedPoint.autoPaused)).toBe(true);
  });

  it("does not reconnect active segments across an auto-paused gap", () => {
    const points = [
      { ...point(-22.9000, -43.2000, 0), elevation: 100 },
      { ...point(-22.9000, -43.2005, 10), elevation: 110 },
      { ...point(-22.9000, -43.2050, 20, true), elevation: 500 },
      { ...point(-22.9000, -43.2055, 30), elevation: 501 },
      { ...point(-22.9000, -43.2060, 40), elevation: 511 },
    ];

    const activity = buildRecordedActivity(
      "running",
      new Date(0),
      new Date(40_000),
      points,
      20
    );

    expect(activity.distanceM).toBeLessThan(150);
    expect(activity.elevationGainM).toBe(20);
    expect(activity.trackSegments).toHaveLength(2);
  });

  it("keeps a single paused marker as a boundary when resuming", () => {
    const points = [
      { ...point(-22.9000, -43.2000, 0), elevation: 100 },
      { ...point(-22.9000, -43.2005, 10), elevation: 110 },
      { ...point(-22.9000, -43.2050, 20, true), elevation: 500 },
      { ...point(-22.9000, -43.2050, 20, false), elevation: 500 },
      { ...point(-22.9000, -43.2060, 30), elevation: 510 },
    ];

    const activity = buildRecordedActivity(
      "running",
      new Date(0),
      new Date(30_000),
      points,
      20
    );

    expect(activity.trackSegments).toHaveLength(2);
    expect(activity.distanceM).toBeLessThan(160);
    expect(activity.elevationGainM).toBe(20);
  });
});
