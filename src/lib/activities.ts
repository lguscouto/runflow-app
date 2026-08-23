import { v4 as uuidv4 } from "uuid";
import type {
  ActivityDetail,
  ActivitySummary,
  DashboardStats,
  ParsedActivity,
  TrackPoint,
} from "./types";
import { simplifyPoints } from "./geo";
import { estimateActivityCalories } from "./calories";
import { getUserProfile } from "./profile";
import { computeCyclingActivityStats } from "./cycling-physics";
import {
  getAllStoredActivities,
  getAllStoredSummaries,
  getStoredActivity,
  putActivity,
  removeActivity,
  toActivityDetail,
  toActivitySummary,
  type StoredActivity,
  getAllStoredGear,
  listStoredActivitiesWithCursor,
} from "./storage";

async function resolveCalories(parsed: ParsedActivity): Promise<number | null> {
  if (parsed.calories != null && parsed.calories > 0) {
    return Math.round(parsed.calories);
  }
  const profile = await getUserProfile();
  return estimateActivityCalories(profile, {
    sport: parsed.sport,
    durationSec: parsed.durationSec,
    distanceM: parsed.distanceM,
    avgPaceSecKm: parsed.avgPaceSecKm,
    elevationGainM: parsed.elevationGainM,
  });
}

export async function saveActivity(
  parsed: ParsedActivity,
  source: string,
  fileName?: string
): Promise<string> {
  const id = uuidv4();
  const points = simplifyPoints(parsed.points, 1200);
  const calories = await resolveCalories(parsed);
  const profile = await getUserProfile();

  const gears = await getAllStoredGear();
  let defaultGear = null;
  if (parsed.sport === "cycling") {
    defaultGear =
      gears.find((g) => g.type === "bike" && g.isDefaultCycling && g.status === "active") ||
      gears.find((g) => g.type === "bike" && g.status === "active") ||
      null;
  } else {
    defaultGear =
      gears.find((g) => (g.type || "shoes") === "shoes" && g.isDefault && g.status === "active") ||
      gears.find((g) => (g.type || "shoes") === "shoes" && g.status === "active") ||
      null;
  }
  const gearId = defaultGear ? defaultGear.id : null;

  // Se for ciclismo, calcula métricas físicas científicas agregadas caso ainda não existam
  let cyclingStats: ReturnType<typeof computeCyclingActivityStats> | null = null;
  if (parsed.sport === "cycling") {
    cyclingStats = computeCyclingActivityStats(
      points,
      parsed.movingTimeSec || parsed.durationSec,
      profile?.weightKg,
      defaultGear?.weightKg,
      defaultGear?.bikeType
    );
  }

  const avgSpeedKmh =
    parsed.avgSpeedKmh ??
    cyclingStats?.avgSpeedKmh ??
    (parsed.distanceM > 0 && parsed.durationSec > 0
      ? Number(((parsed.distanceM / parsed.durationSec) * 3.6).toFixed(1))
      : null);

  const maxSpeedKmh = parsed.maxSpeedKmh ?? cyclingStats?.maxSpeedKmh ?? null;
  const avgWatts = parsed.avgWatts ?? cyclingStats?.avgWatts ?? null;
  const maxWatts = parsed.maxWatts ?? cyclingStats?.maxWatts ?? null;
  const normalizedPowerWatts = parsed.normalizedPowerWatts ?? cyclingStats?.normalizedPowerWatts ?? null;
  const vamMh = parsed.vamMh ?? cyclingStats?.vamMh ?? null;
  const maxGradePercent = parsed.maxGradePercent ?? cyclingStats?.maxGradePercent ?? null;
  const avgCadenceRpm = parsed.avgCadenceRpm ?? null;
  const maxCadenceRpm = parsed.maxCadenceRpm ?? null;

  const stored: StoredActivity = {
    id,
    name: parsed.name,
    sport: parsed.sport,
    startedAt: parsed.startedAt.toISOString(),
    durationSec: parsed.durationSec,
    movingTimeSec: parsed.movingTimeSec ?? parsed.durationSec,
    elapsedTimeSec: parsed.elapsedTimeSec ?? parsed.durationSec,
    distanceM: parsed.distanceM,
    avgPaceSecKm: parsed.avgPaceSecKm ?? null,
    maxPaceSecKm: parsed.maxPaceSecKm ?? null,
    avgSpeedKmh,
    maxSpeedKmh,
    avgWatts,
    maxWatts,
    normalizedPowerWatts,
    vamMh,
    maxGradePercent,
    avgCadenceRpm,
    maxCadenceRpm,
    calories,
    elevationGainM: parsed.elevationGainM ?? null,
    avgHr: parsed.avgHr ?? null,
    maxHr: parsed.maxHr ?? null,
    source,
    fileName: fileName ?? null,
    notes: null,
    gearId,
    workoutId: parsed.workoutId || null,
    structuredWorkoutReport: parsed.structuredWorkoutReport || null,
    points: points.map((p, idx) => ({
      lat: p.lat,
      lng: p.lng,
      elevation: p.elevation,
      timestamp: p.timestamp?.toISOString(),
      hr: p.hr,
      watts: p.watts ?? (cyclingStats && cyclingStats.powerSeriesWatts[idx] != null ? cyclingStats.powerSeriesWatts[idx] : undefined),
      cadence: p.cadence,
      speedKmh: p.speedKmh,
      grade: p.grade,
    })),
  };

  await putActivity(stored);
  return id;
}

export async function listActivities(
  limit = 50
): Promise<ActivitySummary[]> {
  return listStoredActivitiesWithCursor(limit);
}

export async function getActivity(
  id: string
): Promise<ActivityDetail | null> {
  const stored = await getStoredActivity(id);
  if (!stored) return null;
  return toActivityDetail(stored);
}

export async function deleteActivity(id: string): Promise<boolean> {
  return removeActivity(id);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const all = await getAllStoredSummaries();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  let totalDistanceM = 0;
  let totalDurationSec = 0;
  let thisWeekDistanceM = 0;
  let thisWeekActivities = 0;

  for (const a of all) {
    totalDistanceM += a.distanceM;
    totalDurationSec += a.durationSec;
    if (new Date(a.startedAt).getTime() >= weekAgo) {
      thisWeekDistanceM += a.distanceM;
      thisWeekActivities += 1;
    }
  }

  return {
    totalActivities: all.length,
    totalDistanceM,
    totalDurationSec,
    thisWeekDistanceM,
    thisWeekActivities,
  };
}

export function createDemoActivity(): ParsedActivity {
  const baseLat = -23.55052;
  const baseLng = -46.633308;
  const startedAt = new Date();
  const durationSec = 1560; // 26 min
  const distanceM = 5020; // 5.02 km
  const points: TrackPoint[] = [];

  const totalPoints = 60;
  for (let i = 0; i < totalPoints; i++) {
    const fraction = i / (totalPoints - 1);
    const angle = fraction * Math.PI * 2;
    const lat = baseLat + 0.009 * Math.sin(angle) + 0.003 * Math.sin(angle * 2);
    const lng = baseLng + 0.013 * Math.cos(angle);
    const elevation = 760 + 28 * Math.sin(fraction * Math.PI * 3);
    const hr = 145 + Math.floor(22 * Math.sin(fraction * Math.PI * 2));
    const timestamp = new Date(startedAt.getTime() + fraction * durationSec * 1000);

    points.push({ lat, lng, elevation, hr, timestamp });
  }

  return {
    name: "Corrida no Parque Ibirapuera",
    sport: "running",
    startedAt,
    durationSec,
    distanceM,
    avgPaceSecKm: 311, // ~5:11 /km
    maxPaceSecKm: 275, // ~4:35 /km
    avgHr: 154,
    maxHr: 172,
    elevationGainM: 68,
    calories: 385,
    points,
  };
}

