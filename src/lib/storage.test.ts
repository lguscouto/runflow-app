import { describe, it, expect, beforeEach } from "vitest";
import {
  putActivity,
  getStoredActivity,
  getAllStoredSummaries,
  removeActivity,
  toActivitySummary,
  type StoredActivity,
} from "./storage";

describe("IndexedDB v6 Storage Isolation & CRUD", () => {
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
});
