import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ActivityDetail, ActivitySummary, Sport, TrackPoint, UserProfile } from "./types";

export const PROFILE_KEY = "user";

export interface StoredActivity extends ActivitySummary {
  maxPaceSecKm: number | null;
  maxHr: number | null;
  notes: string | null;
  points: Array<{
    lat: number;
    lng: number;
    elevation?: number;
    timestamp?: string;
    hr?: number;
  }>;
}

interface RunFlowDB extends DBSchema {
  activities: {
    key: string;
    value: StoredActivity;
    indexes: { "by-started": string };
  };
  profile: {
    key: string;
    value: UserProfile;
  };
}

const DB_NAME = "runflow";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<RunFlowDB>> | null = null;

export function getStore(): Promise<IDBPDatabase<RunFlowDB>> {
  if (!dbPromise) {
    dbPromise = openDB<RunFlowDB>(DB_NAME, DB_VERSION, {
      upgrade(database, oldVersion) {
        if (!database.objectStoreNames.contains("activities")) {
          const store = database.createObjectStore("activities", {
            keyPath: "id",
          });
          store.createIndex("by-started", "startedAt");
        }
        if (oldVersion < 2 && !database.objectStoreNames.contains("profile")) {
          database.createObjectStore("profile");
        }
      },
    });
  }
  return dbPromise;
}

export async function putActivity(activity: StoredActivity): Promise<void> {
  const db = await getStore();
  await db.put("activities", activity);
}

export async function getStoredActivity(
  id: string
): Promise<StoredActivity | undefined> {
  const db = await getStore();
  return db.get("activities", id);
}

export async function getAllStoredActivities(): Promise<StoredActivity[]> {
  const db = await getStore();
  const all = await db.getAll("activities");
  return all.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

export async function removeActivity(id: string): Promise<boolean> {
  const db = await getStore();
  const existing = await db.get("activities", id);
  if (!existing) return false;
  await db.delete("activities", id);
  return true;
}

export function toActivityDetail(stored: StoredActivity): ActivityDetail {
  const points: TrackPoint[] = stored.points.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    elevation: p.elevation,
    timestamp: p.timestamp ? new Date(p.timestamp) : undefined,
    hr: p.hr,
  }));
  return { ...stored, points };
}

export function toActivitySummary(stored: StoredActivity): ActivitySummary {
  const {
    id,
    name,
    sport,
    startedAt,
    durationSec,
    distanceM,
    avgPaceSecKm,
    elevationGainM,
    avgHr,
    calories,
    source,
    fileName,
  } = stored;
  return {
    id,
    name,
    sport,
    startedAt,
    durationSec,
    distanceM,
    avgPaceSecKm,
    elevationGainM,
    avgHr,
    calories,
    source,
    fileName,
  };
}
