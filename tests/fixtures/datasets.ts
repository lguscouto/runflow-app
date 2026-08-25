import { makeStoredActivity, makeStructuredWorkoutReport } from "./activityFactory";
import { toActivitySummary, type StoredActivity } from "@/lib/storage";
import type { ActivitySummary, Gear } from "@/lib/types";

export const SUMMARY_COUNTS = [0, 25, 100, 1_000] as const;
export const GPS_POINT_COUNTS = [1_000, 10_000, 50_000] as const;

function assertValidCount(count: number): void {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError("synthetic fixture count must be a non-negative integer");
  }
}

export function generateSyntheticActivities(count: number): StoredActivity[] {
  assertValidCount(count);
  const list: StoredActivity[] = [];
  const baseDate = new Date("2026-08-24T12:00:00.000Z").getTime();

  for (let i = 0; i < count; i++) {
    const startedAt = new Date(baseDate - i * 86400000).toISOString();
    const isCycling = i % 3 === 0;
    list.push(
      makeStoredActivity({
        id: `synth-act-${i.toString().padStart(4, "0")}`,
        name: `${isCycling ? "Pedal" : "Corrida"} Sintético #${i + 1}`,
        sport: isCycling ? "cycling" : "running",
        startedAt,
        distanceM: 5000 + (i % 20) * 1000,
        durationSec: 1800 + (i % 20) * 300,
        avgPaceSecKm: isCycling ? null : 330 + (i % 30) * 5,
        avgSpeedKmh: isCycling ? 25.5 + (i % 10) : 10.5,
        avgWatts: isCycling ? 180 + (i % 50) : null,
        workoutId: i % 5 === 0 ? `workout-${i}` : null,
        structuredWorkoutReport:
          i % 5 === 0
            ? makeStructuredWorkoutReport({ workoutId: `workout-${i}` })
            : null,
      })
    );
  }

  return list;
}

export function makeSyntheticGear(overrides: Partial<Gear> = {}): Gear {
  return {
    id: "gear-synthetic-shoes",
    name: "Tênis sintético",
    brand: "Marca sintética",
    model: "Modelo de teste",
    type: "shoes",
    initialDistanceM: 0,
    maxDistanceM: 800_000,
    status: "active",
    isDefault: true,
    isDefaultCycling: false,
    notes: "Equipamento criado para testes determinísticos.",
    createdAt: "2026-08-20T12:00:00.000Z",
    ...overrides,
  };
}

export const makeGear = makeSyntheticGear;

export function makeSyntheticBike(overrides: Partial<Gear> = {}): Gear {
  return makeSyntheticGear({
    id: "gear-synthetic-bike",
    name: "Bicicleta sintética",
    brand: "Marca sintética",
    model: "Road Test 01",
    type: "bike",
    bikeType: "road",
    weightKg: 8.5,
    wheelSize: "700x28c",
    initialDistanceM: 0,
    maxDistanceM: 20_000_000,
    status: "active",
    isDefault: false,
    isDefaultCycling: true,
    components: [
      {
        id: "component-synthetic-chain",
        name: "Corrente sintética",
        type: "chain",
        brandModel: "Modelo de teste",
        installedDistanceM: 0,
        maxDistanceM: 3_000_000,
        installedAt: "2026-08-20T12:00:00.000Z",
        maintenanceHistory: [],
      },
    ],
    ...overrides,
  });
}

export const makeBike = makeSyntheticBike;

export function generateSyntheticSummaries(count: number): ActivitySummary[] {
  return generateSyntheticActivities(count).map(toActivitySummary);
}

export function generateSyntheticGpsPoints(
  count: number
): StoredActivity["points"] {
  assertValidCount(count);
  const points: StoredActivity["points"] = [];
  const baseTimestamp = Date.parse("2026-08-24T10:00:00.000Z");

  for (let i = 0; i < count; i += 1) {
    points.push({
      lat: 1.2345 + i * 0.00001,
      lng: -2.3456 - i * 0.00001,
      elevation: 100 + (i % 50),
      timestamp: new Date(baseTimestamp + i * 1_000).toISOString(),
      hr: 130 + (i % 40),
    });
  }

  return points;
}

export function makeSyntheticActivityWithPoints(
  pointCount: number,
  overrides: Partial<StoredActivity> = {}
): StoredActivity {
  assertValidCount(pointCount);
  return makeStoredActivity({
    id: `activity-gps-${pointCount}`,
    name: `Atividade GPS sintética ${pointCount}`,
    distanceM: pointCount === 0 ? 0 : pointCount,
    points: generateSyntheticGpsPoints(pointCount),
    ...overrides,
  });
}

export const makeActivityWithPoints = makeSyntheticActivityWithPoints;

export function generateEqualDateSummaries(count: number): ActivitySummary[] {
  const startedAt = "2026-08-24T12:00:00.000Z";
  return generateSyntheticActivities(count).map((activity) =>
    toActivitySummary({ ...activity, startedAt })
  );
}
