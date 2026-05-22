import { v4 as uuidv4 } from "uuid";
import type {
  ActivityDetail,
  ActivitySummary,
  DashboardStats,
  ParsedActivity,
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
  const all = await getAllStoredActivities();
  return all.slice(0, limit).map(toActivitySummary);
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
