import type {
  Sport,
  StructuredWorkout,
  StructuredWorkoutReport,
} from "@/lib/types";
import type { StoredActivity } from "@/lib/storage";

export const SYNTHETIC_SOURCE = "synthetic-test" as const;

export const LONG_PORTUGUESE_TEXT = Array.from(
  { length: 24 },
  (_, index) =>
    `Registro de treino sintético ${index + 1}: esforço controlado, recuperação gradual, sensação estável e observações sem dados pessoais.`
).join(" ");

export const LONG_ENGLISH_TEXT = Array.from(
  { length: 24 },
  (_, index) =>
    `Synthetic workout record ${index + 1}: controlled effort, gradual recovery, steady feeling, and notes without personal data.`
).join(" ");

export const LONG_TEXT_PT = LONG_PORTUGUESE_TEXT;
export const LONG_TEXT_EN = LONG_ENGLISH_TEXT;

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
        targetType: "time",
        targetValue: 600,
        durationSec: 600,
        distanceM: 1500,
        avgPaceSecKm: 360,
        avgHr: 139,
        targetMet: true,
      },
      {
        stepIndex: 1,
        name: "Intervalo forte",
        type: "work",
        targetType: "distance",
        targetValue: 1000,
        durationSec: 300,
        distanceM: 1000,
        avgPaceSecKm: 270,
        avgHr: 168,
        targetMet: true,
      },
      {
        stepIndex: 2,
        name: "Recuperação",
        type: "recovery",
        targetType: "time",
        targetValue: 120,
        durationSec: 120,
        distanceM: 300,
        avgPaceSecKm: 400,
        avgHr: 145,
        targetMet: true,
      },
      {
        stepIndex: 3,
        name: "Intervalo forte",
        type: "work",
        targetType: "distance",
        targetValue: 1000,
        durationSec: 300,
        distanceM: 1000,
        avgPaceSecKm: 270,
        avgHr: 170,
        targetMet: true,
      },
      {
        stepIndex: 4,
        name: "Desaquecimento",
        type: "cooldown",
        targetType: "open",
        targetValue: 0,
        durationSec: 600,
        distanceM: 1500,
        avgPaceSecKm: 390,
        avgHr: 140,
        targetMet: true,
      },
    ],
    ...overrides,
  };
}

export function makeStructuredWorkout(
  overrides: Partial<StructuredWorkout> = {}
): StructuredWorkout {
  return {
    id: "workout-synthetic-01",
    name: "Treino sintético de intervalos",
    description: "Fixture determinística para execução estruturada.",
    sport: "running",
    items: [
      {
        id: "step-warmup",
        type: "warmup",
        name: "Aquecimento",
        targetType: "time",
        targetValue: 600,
      },
      {
        id: "repeat-intervals",
        type: "repeat",
        repeats: 3,
        steps: [
          {
            id: "step-work",
            type: "work",
            name: "Intervalo",
            targetType: "distance",
            targetValue: 1_000,
            paceTarget: { minPaceSecKm: 260, maxPaceSecKm: 280 },
            hrZoneTarget: 4,
          },
          {
            id: "step-recovery",
            type: "recovery",
            name: "Recuperação",
            targetType: "time",
            targetValue: 120,
            hrZoneTarget: 2,
          },
        ],
      },
      {
        id: "step-cooldown",
        type: "cooldown",
        name: "Desaquecimento",
        targetType: "time",
        targetValue: 600,
      },
    ],
    isPreset: false,
    createdAt: "2026-08-20T12:00:00.000Z",
    updatedAt: "2026-08-20T12:00:00.000Z",
    ...overrides,
  };
}

export const makeSyntheticStructuredWorkout = makeStructuredWorkout;

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
    source: SYNTHETIC_SOURCE,
    fileName: null,
    gearId: null,
    routeId: null,
    workoutId: null,
    structuredWorkoutReport: null,
    notes: null,
    points: [
      { lat: 1.2345, lng: -2.3456, elevation: 100, hr: 145 },
      { lat: 1.2346, lng: -2.3457, elevation: 102, hr: 150 },
      { lat: 1.2347, lng: -2.3458, elevation: 104, hr: 155 },
    ],
    ...overrides,
  };
}

export function makeLongTextActivity(
  language: "pt" | "en" = "pt",
  overrides: Partial<StoredActivity> = {}
): StoredActivity {
  const isEnglish = language === "en";
  return makeStoredActivity({
    id: `activity-long-${language}`,
    name: isEnglish ? "Synthetic long-text workout" : "Treino sintético com texto longo",
    notes: isEnglish ? LONG_ENGLISH_TEXT : LONG_PORTUGUESE_TEXT,
    ...overrides,
  });
}

export const makeLongStringActivity = makeLongTextActivity;

export function makeNullHeavyActivity(
  overrides: Partial<StoredActivity> = {}
): StoredActivity {
  return makeStoredActivity({
    id: "activity-null-heavy",
    name: "Atividade sintética sem métricas",
    durationSec: 0,
    movingTimeSec: 0,
    elapsedTimeSec: 0,
    distanceM: 0,
    avgPaceSecKm: null,
    maxPaceSecKm: null,
    avgSpeedKmh: null,
    maxSpeedKmh: null,
    normalizedPowerWatts: null,
    avgWatts: null,
    maxWatts: null,
    vamMh: null,
    maxGradePercent: null,
    avgCadenceRpm: null,
    maxCadenceRpm: null,
    elevationGainM: null,
    avgHr: null,
    maxHr: null,
    calories: null,
    fileName: null,
    gearId: null,
    routeId: null,
    workoutId: null,
    structuredWorkoutReport: null,
    notes: null,
    points: [],
    ...overrides,
  });
}

export const makeNullActivity = makeNullHeavyActivity;
