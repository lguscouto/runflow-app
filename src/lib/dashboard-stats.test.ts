import { describe, expect, it } from "vitest";
import type { ActivitySummary } from "./types";
import {
  applyDashboardStatsDelta,
  computeDashboardStats,
  createDashboardStatsAggregate,
  dashboardStatsFromAggregate,
} from "./dashboard-stats";

function makeSummary(overrides: Partial<ActivitySummary> = {}): ActivitySummary {
  return {
    id: "activity-1",
    name: "Treino sintético",
    sport: "running",
    startedAt: "2026-08-26T10:00:00.000Z",
    durationSec: 600,
    distanceM: 2_000,
    avgPaceSecKm: 300,
    elevationGainM: 0,
    avgHr: null,
    calories: null,
    source: "synthetic-test",
    fileName: null,
    gearId: null,
    ...overrides,
  };
}

describe("dashboard incremental statistics", () => {
  it("applies insert, replacement and removal deltas without rescanning history", () => {
    const first = makeSummary();
    const second = makeSummary({
      id: "activity-2",
      distanceM: 5_000,
      durationSec: 1_800,
    });
    const aggregate = createDashboardStatsAggregate([first]);

    const afterInsert = applyDashboardStatsDelta(aggregate, undefined, second);
    expect(afterInsert).toEqual({
      totalActivities: 2,
      totalDistanceM: 7_000,
      totalDurationSec: 2_400,
    });

    const replacement = { ...first, distanceM: 3_000, durationSec: 900 };
    const afterReplacement = applyDashboardStatsDelta(afterInsert, first, replacement);
    expect(afterReplacement).toEqual({
      totalActivities: 2,
      totalDistanceM: 8_000,
      totalDurationSec: 2_700,
    });

    expect(applyDashboardStatsDelta(afterReplacement, second, undefined)).toEqual({
      totalActivities: 1,
      totalDistanceM: 3_000,
      totalDurationSec: 900,
    });
  });

  it("keeps the weekly window separate from the historical aggregate", () => {
    const now = Date.parse("2026-08-26T12:00:00.000Z");
    const recent = makeSummary({
      startedAt: "2026-08-24T12:00:00.000Z",
      distanceM: 1_000,
    });
    const old = makeSummary({
      id: "activity-old",
      startedAt: "2026-08-18T11:59:59.999Z",
      distanceM: 9_000,
      durationSec: 2_700,
    });
    const invalidDate = makeSummary({
      id: "activity-invalid-date",
      startedAt: "not-a-date",
      distanceM: 99_000,
    });
    const future = makeSummary({
      id: "activity-future",
      startedAt: "2026-08-26T13:00:00.000Z",
      distanceM: 4_000,
      durationSec: 1_200,
    });
    const aggregate = createDashboardStatsAggregate([recent, old, future]);

    expect(dashboardStatsFromAggregate(aggregate, [recent, invalidDate, future], now)).toEqual({
      totalActivities: 3,
      totalDistanceM: 14_000,
      totalDurationSec: 4_500,
      thisWeekDistanceM: 1_000,
      thisWeekActivities: 1,
    });
    expect(computeDashboardStats([recent, old, future], now)).toEqual({
      totalActivities: 3,
      totalDistanceM: 14_000,
      totalDurationSec: 4_500,
      thisWeekDistanceM: 1_000,
      thisWeekActivities: 1,
    });
  });
});
