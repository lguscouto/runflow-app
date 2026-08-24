import type {
  ActivitySummary,
  ActivityDetail,
  Sport,
  StructuredWorkoutReport,
} from "@/lib/types";
import type { StoredActivity } from "@/lib/storage";

export function makeStructuredWorkoutReport(
  overrides: Partial<StructuredWorkoutReport> = {}
): StructuredWorkoutReport {
  return {
    workoutId: "workout-sample-01",
    workoutName: "Intervalado 5x 1km Z4",
    completedAt: "2026-08-24T11:00:00.000Z",
    totalSteps: 5,
    completedSteps: 5,
    complianceRatePercent: 100,
    steps: [
      {
        stepIndex: 0,
        name: "Aquecimento",
        type: "warmup",
        targetType: "open",
        targetValue: 600,
        durationSec: 600,
        distanceM: 1500,
        avgPaceSecKm: 360,
        avgHr: 139,
        targetMet: true,
      },
    ],
    ...overrides,
  };
}

export function makeStoredActivity(
  overrides: Partial<StoredActivity> = {}
): StoredActivity {
  return {
    id: "activity-001",
    name: "Treino sintético",
    sport: "running" as Sport,
    startedAt: "2026-08-24T10:00:00.000Z",
    durationSec: 3600,
    movingTimeSec: 3500,
    elapsedTimeSec: 3600,
    distanceM: 10000,
    avgPaceSecKm: 360,
    maxPaceSecKm: 300,
    avgSpeedKmh: 10.0,
    maxSpeedKmh: 14.0,
    avgWatts: null,
    maxWatts: null,
    normalizedPowerWatts: null,
    vamMh: null,
    maxGradePercent: null,
    avgCadenceRpm: 175,
    maxCadenceRpm: 182,
    elevationGainM: 100,
    avgHr: 150,
    maxHr: 175,
    calories: 700,
    source: "synthetic-test",
    fileName: null,
    gearId: null,
    routeId: null,
    workoutId: null,
    structuredWorkoutReport: null,
    notes: null,
    points: [
      { lat: -23.5505, lng: -46.6333, elevation: 760, hr: 145 },
      { lat: -23.5510, lng: -46.6340, elevation: 762, hr: 150 },
      { lat: -23.5520, lng: -46.6350, elevation: 765, hr: 155 },
    ],
    ...overrides,
  };
}
