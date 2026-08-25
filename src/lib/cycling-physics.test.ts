import { describe, expect, it } from "vitest";
import {
  calculateCyclingPower,
  computeCyclingActivityStats,
  computeInstantGradePercent,
} from "./cycling-physics";

describe("cycling physics Auto-Pause boundaries", () => {
  it("does not calculate grade across an auto-paused boundary", () => {
    const points = [
      { lat: -22.9, lng: -43.2, elevation: 100, timestamp: new Date(0) },
      {
        lat: -22.9,
        lng: -43.2,
        elevation: 100,
        timestamp: new Date(1_000),
        autoPaused: true,
      },
      { lat: -22.899, lng: -43.2, elevation: 120, timestamp: new Date(2_000) },
    ];

    expect(computeInstantGradePercent(points, 30)).toBe(0);
  });

  it("does not aggregate cycling metrics across an auto-paused boundary", () => {
    const points = [
      { lat: -22.9, lng: -43.2, timestamp: new Date(0), elevation: 100 },
      {
        lat: -22.9,
        lng: -43.199,
        timestamp: new Date(1_000),
        elevation: 500,
        autoPaused: true,
      },
      { lat: -22.9, lng: -43.1989, timestamp: new Date(2_000), elevation: 510 },
      { lat: -22.9, lng: -43.1988, timestamp: new Date(3_000), elevation: 510 },
    ];

    const stats = computeCyclingActivityStats(points, 10);

    expect(stats.avgSpeedKmh).toBeCloseTo(4, 0);
    expect(stats.maxGradePercent).toBeNull();
    expect(stats.powerSeriesWatts).toHaveLength(points.length);
  });

  it("ignores negative native power instead of persisting invalid metrics", () => {
    const points = [
      { lat: -22.9, lng: -43.2, timestamp: new Date(0), watts: -50 },
      { lat: -22.899, lng: -43.2, timestamp: new Date(1_000), watts: -20 },
    ];

    const stats = computeCyclingActivityStats(points, 1);

    expect(stats.powerSeriesWatts[1]).toBeGreaterThanOrEqual(0);
    expect(stats.avgWatts).toBeGreaterThanOrEqual(0);
    expect(stats.maxWatts).toBeGreaterThanOrEqual(0);
  });

  it("does not turn a backwards timestamp into an artificial high-speed edge", () => {
    const points = [
      { lat: -22.9, lng: -43.2, timestamp: new Date(2_000) },
      { lat: -22.899, lng: -43.2, timestamp: new Date(1_000) },
    ];

    const stats = computeCyclingActivityStats(points, 1);

    expect(stats.maxSpeedKmh).toBeNull();
    expect(stats.avgWatts).toBeNull();
    expect(stats.powerSeriesWatts).toEqual([0, 0]);
  });

  it("ignores GPS jitter edges below the recording threshold", () => {
    const points = [
      { lat: -22.9, lng: -43.2, timestamp: new Date(0) },
      { lat: -22.90001, lng: -43.2, timestamp: new Date(1_000) },
    ];

    const stats = computeCyclingActivityStats(points, 1);

    expect(stats.avgSpeedKmh).toBeNull();
    expect(stats.maxSpeedKmh).toBeNull();
    expect(stats.avgWatts).toBeNull();
    expect(stats.powerSeriesWatts).toEqual([0, 0]);
  });

  it("returns a finite zero breakdown for non-finite physical inputs", () => {
    const breakdown = calculateCyclingPower({
      speedMs: Number.NaN,
      gradePercent: Number.POSITIVE_INFINITY,
      riderMassKg: Number.POSITIVE_INFINITY,
      windSpeedMs: Number.NaN,
    });

    expect(breakdown).toEqual({ totalWatts: 0, aeroWatts: 0, climbWatts: 0, rollingWatts: 0 });
    expect(Object.values(breakdown).every(Number.isFinite)).toBe(true);
  });
});