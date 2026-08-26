import { describe, it, expect, beforeEach } from "vitest";
import {
  putActivity,
  getStoredActivity,
  getAllStoredSummaries,
  getStoredDashboardStats,
  removeActivity,
  toActivitySummary,
  type StoredActivity,
} from "./storage";

describe("IndexedDB v9 Storage, Activity CRUD & Incremental Stats", () => {
  const sampleActivity: StoredActivity = {
    id: "act-test-01",
    name: "Treino Teste 10k",
    sport: "running",
    startedAt: "2026-08-23T10:00:00Z",
    durationSec: 3600,
    distanceM: 10000,
    avgPaceSecKm: 360,
    avgSpeedKmh: 10.0,
    maxSpeedKmh: 14.5,
    avgWatts: null,
    maxWatts: null,
    normalizedPowerWatts: null,
    vamMh: null,
    maxGradePercent: null,
    avgCadenceRpm: 175,
    maxCadenceRpm: 182,
    elevationGainM: 120,
    avgHr: 155,
    maxHr: 172,
    maxPaceSecKm: 300,
    calories: 750,
    source: "gps",
    fileName: null,
    gearId: null,
    notes: "Sensação boa, ritmo constante",
    points: [
      { lat: -23.5874, lng: -46.6576, elevation: 760, hr: 140 },
      { lat: -23.5878, lng: -46.6580, elevation: 762, hr: 152 },
      { lat: -23.5882, lng: -46.6585, elevation: 765, hr: 158 },
    ],
  };

  it("should save activity into both summary and track stores", async () => {
    await putActivity(sampleActivity);

    const full = await getStoredActivity("act-test-01");
    expect(full).toBeDefined();
    expect(full?.id).toBe("act-test-01");
    expect(full?.points).toHaveLength(3);
    expect(full?.notes).toBe("Sensação boa, ritmo constante");
  });

  it("should retrieve summaries without exposing points in memory", async () => {
    await putActivity(sampleActivity);

    const summaries = await getAllStoredSummaries();
    expect(summaries.length).toBeGreaterThan(0);
    const summary = summaries.find((s) => s.id === "act-test-01");
    expect(summary).toBeDefined();
    expect(summary?.name).toBe("Treino Teste 10k");
    // Resumo leve não deve conter a propriedade points
    expect((summary as any).points).toBeUndefined();
  });

  it("should remove activity cleanly from all stores", async () => {
    await putActivity(sampleActivity);
    const removed = await removeActivity("act-test-01");
    expect(removed).toBe(true);

    const after = await getStoredActivity("act-test-01");
    expect(after).toBeUndefined();

    const summaries = await getAllStoredSummaries();
    expect(summaries.find((s) => s.id === "act-test-01")).toBeUndefined();
  });

  it("should maintain dashboard totals incrementally across insert, update and delete", async () => {
    const now = Date.parse("2026-08-26T12:00:00.000Z");
    const recent = {
      ...sampleActivity,
      id: "aggregate-recent",
      startedAt: "2026-08-24T12:00:00.000Z",
      distanceM: 1_000,
      durationSec: 600,
    };
    const old = {
      ...sampleActivity,
      id: "aggregate-old",
      startedAt: "2026-08-18T11:59:59.999Z",
      distanceM: 9_000,
      durationSec: 2_700,
    };

    await putActivity(recent);
    await putActivity(old);
    await expect(getStoredDashboardStats(now)).resolves.toEqual({
      totalActivities: 2,
      totalDistanceM: 10_000,
      totalDurationSec: 3_300,
      thisWeekDistanceM: 1_000,
      thisWeekActivities: 1,
    });

    await putActivity({ ...recent, distanceM: 1_500, durationSec: 900 });
    await expect(getStoredDashboardStats(now)).resolves.toMatchObject({
      totalActivities: 2,
      totalDistanceM: 10_500,
      totalDurationSec: 3_600,
      thisWeekDistanceM: 1_500,
      thisWeekActivities: 1,
    });

    await expect(removeActivity(old.id)).resolves.toBe(true);
    await expect(getStoredDashboardStats(now)).resolves.toEqual({
      totalActivities: 1,
      totalDistanceM: 1_500,
      totalDurationSec: 900,
      thisWeekDistanceM: 1_500,
      thisWeekActivities: 1,
    });
    await removeActivity(recent.id);
  });

  it("uses the numeric timestamp index for timezone-offset dates", async () => {
    const now = Date.parse("2026-08-26T12:00:00.000Z");
    const activity = {
      ...sampleActivity,
      id: "aggregate-offset",
      startedAt: "2026-08-19T10:00:00-03:00",
      distanceM: 4_000,
      durationSec: 1_200,
    };

    await putActivity(activity);
    await expect(getStoredDashboardStats(now)).resolves.toMatchObject({
      totalActivities: 1,
      thisWeekDistanceM: 4_000,
      thisWeekActivities: 1,
    });
    await removeActivity(activity.id);
  });

  it("excludes future timestamps from the weekly window", async () => {
    const now = Date.parse("2026-08-26T12:00:00.000Z");
    const future = {
      ...sampleActivity,
      id: "aggregate-future",
      startedAt: "2026-08-26T13:00:00.000Z",
      distanceM: 4_000,
      durationSec: 1_200,
    };

    await putActivity(future);
    await expect(getStoredDashboardStats(now)).resolves.toMatchObject({
      totalActivities: 1,
      totalDistanceM: 4_000,
      totalDurationSec: 1_200,
      thisWeekDistanceM: 0,
      thisWeekActivities: 0,
    });
    await removeActivity(future.id);
  });
});
