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
import {
  getAllStoredActivities,
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

  const gears = await getAllStoredGear();
  const defaultGear = gears.find((g) => g.isDefault && g.status === "active");
  const gearId = defaultGear ? defaultGear.id : null;

  const stored: StoredActivity = {
    id,
    name: parsed.name,
    sport: parsed.sport,
    startedAt: parsed.startedAt.toISOString(),
    durationSec: parsed.durationSec,
    distanceM: parsed.distanceM,
    avgPaceSecKm: parsed.avgPaceSecKm ?? null,
    maxPaceSecKm: parsed.maxPaceSecKm ?? null,
    calories,
    elevationGainM: parsed.elevationGainM ?? null,
    avgHr: parsed.avgHr ?? null,
    maxHr: parsed.maxHr ?? null,
    source,
    fileName: fileName ?? null,
    notes: null,
    gearId,
    points: points.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      elevation: p.elevation,
      timestamp: p.timestamp?.toISOString(),
      hr: p.hr,
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
  const all = await getAllStoredActivities();
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

