import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  ActivityDetail,
  ActivitySummary,
  Sport,
  TrackPoint,
  UserProfile,
  Gear,
  SavedRoute,
  StructuredWorkout,
} from "./types";

export const PROFILE_KEY = "user";

export interface StoredActivityTrack {
  id: string;
  points: Array<{
    lat: number;
    lng: number;
    elevation?: number;
    timestamp?: string;
    hr?: number;
    watts?: number;
    cadence?: number;
    speedKmh?: number;
    grade?: number;
  }>;
  maxPaceSecKm?: number | null;
  maxHr?: number | null;
  notes?: string | null;
}

export interface StoredActivity extends ActivitySummary {
  maxPaceSecKm: number | null;
  maxHr: number | null;
  notes: string | null;
  routeId?: string | null;
  workoutId?: string | null;
  points: Array<{
    lat: number;
    lng: number;
    elevation?: number;
    timestamp?: string;
    hr?: number;
    watts?: number;
    cadence?: number;
    speedKmh?: number;
    grade?: number;
  }>;
}

interface RunFlowDB extends DBSchema {
  activities: {
    key: string;
    value: StoredActivity;
    indexes: { "by-started": string };
  };
  activitySummaries: {
    key: string;
    value: ActivitySummary;
    indexes: { "by-started": string };
  };
  activityTracks: {
    key: string;
    value: StoredActivityTrack;
  };
  profile: {
    key: string;
    value: UserProfile;
  };
  gear: {
    key: string;
    value: Gear;
  };
  routes: {
    key: string;
    value: SavedRoute;
  };
  workouts: {
    key: string;
    value: StructuredWorkout;
  };
}

const DB_NAME = "runflow";
const DB_VERSION = 6;

let dbPromise: Promise<IDBPDatabase<RunFlowDB>> | null = null;

export function getStore(): Promise<IDBPDatabase<RunFlowDB>> {
  if (!dbPromise) {
    dbPromise = openDB<RunFlowDB>(DB_NAME, DB_VERSION, {
      async upgrade(database, oldVersion, _newVersion, transaction) {
        if (!database.objectStoreNames.contains("activities")) {
          const store = database.createObjectStore("activities", {
            keyPath: "id",
          });
          store.createIndex("by-started", "startedAt");
        }
        if (oldVersion < 2 && !database.objectStoreNames.contains("profile")) {
          database.createObjectStore("profile");
        }
        if (oldVersion < 3 && !database.objectStoreNames.contains("gear")) {
          database.createObjectStore("gear", {
            keyPath: "id",
          });
        }
        if (oldVersion < 4 && !database.objectStoreNames.contains("routes")) {
          database.createObjectStore("routes", {
            keyPath: "id",
          });
        }
        if (oldVersion < 5 && !database.objectStoreNames.contains("workouts")) {
          database.createObjectStore("workouts", {
            keyPath: "id",
          });
        }
        if (oldVersion < 6) {
          if (!database.objectStoreNames.contains("activitySummaries")) {
            const summaryStore = database.createObjectStore("activitySummaries", {
              keyPath: "id",
            });
            summaryStore.createIndex("by-started", "startedAt");
          }
          if (!database.objectStoreNames.contains("activityTracks")) {
            database.createObjectStore("activityTracks", {
              keyPath: "id",
            });
          }

          // Migrate existing data from 'activities' to split stores
          if (database.objectStoreNames.contains("activities")) {
            try {
              const actStore = transaction.objectStore("activities");
              const summaryStore = transaction.objectStore("activitySummaries");
              const trackStore = transaction.objectStore("activityTracks");
              let cursor = await actStore.openCursor();
              while (cursor) {
                const act = cursor.value as StoredActivity;
                const summary = toActivitySummary(act);
                const track: StoredActivityTrack = {
                  id: act.id,
                  points: act.points || [],
                  maxPaceSecKm: act.maxPaceSecKm,
                  maxHr: act.maxHr,
                  notes: act.notes,
                };
                await summaryStore.put(summary);
                await trackStore.put(track);
                cursor = await cursor.continue();
              }
            } catch (err) {
              console.warn("RunFlow DB v6 migration notice:", err);
            }
          }
        }
      },
    });
  }
  return dbPromise;
}

export async function putActivity(activity: StoredActivity): Promise<void> {
  const db = await getStore();
  const summary = toActivitySummary(activity);
  const track: StoredActivityTrack = {
    id: activity.id,
    points: activity.points || [],
    maxPaceSecKm: activity.maxPaceSecKm,
    maxHr: activity.maxHr,
    notes: activity.notes,
  };
  const tx = db.transaction(
    ["activities", "activitySummaries", "activityTracks"],
    "readwrite"
  );
  await Promise.all([
    tx.objectStore("activities").put(activity),
    tx.objectStore("activitySummaries").put(summary),
    tx.objectStore("activityTracks").put(track),
    tx.done,
  ]);
}

export async function getStoredActivity(
  id: string
): Promise<StoredActivity | undefined> {
  const db = await getStore();
  try {
    const [summary, track] = await Promise.all([
      db.get("activitySummaries", id),
      db.get("activityTracks", id),
    ]);
    if (summary && track) {
      return {
        ...summary,
        points: track.points || [],
        maxPaceSecKm: track.maxPaceSecKm ?? null,
        maxHr: track.maxHr ?? null,
        notes: track.notes ?? null,
      };
    }
  } catch {
    // fallback
  }
  return db.get("activities", id);
}

export async function getAllStoredActivities(): Promise<StoredActivity[]> {
  const db = await getStore();
  const all = await db.getAll("activities");
  return all.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

/**
 * Retorna todos os resumos de atividades diretamente do store dedicado `activitySummaries`
 * (sem carregar nem desserializar os arrays de trackpoints na heap do V8).
 */
export async function getAllStoredSummaries(): Promise<ActivitySummary[]> {
  const db = await getStore();
  try {
    const tx = db.transaction("activitySummaries", "readonly");
    const index = tx.store.index("by-started");
    const summaries = await index.getAll();
    return summaries.reverse();
  } catch {
    // Fallback caso activitySummaries ainda esteja sendo inicializado
    const tx = db.transaction("activities", "readonly");
    const index = tx.store.index("by-started");
    const summaries: ActivitySummary[] = [];
    let cursor = await index.openCursor(null, "prev");
    while (cursor) {
      summaries.push(toActivitySummary(cursor.value));
      cursor = await cursor.continue();
    }
    return summaries;
  }
}

export async function listStoredActivitiesWithCursor(
  limit = 50
): Promise<ActivitySummary[]> {
  const db = await getStore();
  try {
    const tx = db.transaction("activitySummaries", "readonly");
    const index = tx.store.index("by-started");
    const summaries: ActivitySummary[] = [];
    let cursor = await index.openCursor(null, "prev");
    while (cursor && summaries.length < limit) {
      summaries.push(cursor.value);
      cursor = await cursor.continue();
    }
    return summaries;
  } catch {
    const tx = db.transaction("activities", "readonly");
    const index = tx.store.index("by-started");
    const summaries: ActivitySummary[] = [];
    let cursor = await index.openCursor(null, "prev");
    while (cursor && summaries.length < limit) {
      summaries.push(toActivitySummary(cursor.value));
      cursor = await cursor.continue();
    }
    return summaries;
  }
}

export async function removeActivity(id: string): Promise<boolean> {
  const db = await getStore();
  const existing =
    (await db.get("activities", id)) ||
    (await db.get("activitySummaries", id));
  if (!existing) return false;
  const tx = db.transaction(
    ["activities", "activitySummaries", "activityTracks"],
    "readwrite"
  );
  await Promise.all([
    tx.objectStore("activities").delete(id),
    tx.objectStore("activitySummaries").delete(id),
    tx.objectStore("activityTracks").delete(id),
    tx.done,
  ]);
  return true;
}

export async function putGear(gear: Gear): Promise<void> {
  const db = await getStore();
  await db.put("gear", gear);
}

export async function getStoredGear(id: string): Promise<Gear | undefined> {
  const db = await getStore();
  return db.get("gear", id);
}

export async function getAllStoredGear(): Promise<Gear[]> {
  const db = await getStore();
  return db.getAll("gear");
}

export async function removeGear(id: string): Promise<boolean> {
  const db = await getStore();
  const existing = await db.get("gear", id);
  if (!existing) return false;
  await db.delete("gear", id);
  return true;
}

export function toActivityDetail(stored: StoredActivity): ActivityDetail {
  const points: TrackPoint[] = stored.points.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    elevation: p.elevation,
    timestamp: p.timestamp ? new Date(p.timestamp) : undefined,
    hr: p.hr,
    watts: p.watts,
    cadence: p.cadence,
    speedKmh: p.speedKmh,
    grade: p.grade,
  }));
  return {
    ...stored,
    points,
    movingTimeSec: (stored as any).movingTimeSec ?? stored.durationSec,
    elapsedTimeSec: (stored as any).elapsedTimeSec ?? stored.durationSec,
    routeId: (stored as any).routeId || null,
  };
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
    avgSpeedKmh,
    maxSpeedKmh,
    avgWatts,
    maxWatts,
    normalizedPowerWatts,
    vamMh,
    maxGradePercent,
    avgCadenceRpm,
    maxCadenceRpm,
    elevationGainM,
    avgHr,
    calories,
    source,
    fileName,
    gearId,
    routeId,
  } = stored;
  return {
    id,
    name,
    sport,
    startedAt,
    durationSec,
    movingTimeSec: (stored as any).movingTimeSec ?? durationSec,
    elapsedTimeSec: (stored as any).elapsedTimeSec ?? durationSec,
    distanceM,
    avgPaceSecKm,
    avgSpeedKmh:
      avgSpeedKmh ??
      (sport === "cycling" && avgPaceSecKm
        ? Number((3600 / avgPaceSecKm).toFixed(1))
        : null),
    maxSpeedKmh,
    avgWatts,
    maxWatts,
    normalizedPowerWatts,
    vamMh,
    maxGradePercent,
    avgCadenceRpm,
    maxCadenceRpm,
    elevationGainM,
    avgHr,
    calories,
    source,
    fileName,
    gearId: gearId || null,
    routeId: routeId || null,
  };
}

// ── Routes ──────────────────────────────────────────────────────────────────

export async function putRoute(route: SavedRoute): Promise<void> {
  const db = await getStore();
  await db.put("routes", route);
}

export async function getStoredRoute(
  id: string
): Promise<SavedRoute | undefined> {
  const db = await getStore();
  return db.get("routes", id);
}

export async function getAllStoredRoutes(): Promise<SavedRoute[]> {
  const db = await getStore();
  return db.getAll("routes");
}

export async function removeRoute(id: string): Promise<boolean> {
  const db = await getStore();
  const existing = await db.get("routes", id);
  if (!existing) return false;
  await db.delete("routes", id);
  return true;
}

// ── Structured Workouts (Feature 23) ────────────────────────────────────────

export async function putWorkout(workout: StructuredWorkout): Promise<void> {
  const db = await getStore();
  await db.put("workouts", workout);
}

export async function getStoredWorkout(
  id: string
): Promise<StructuredWorkout | undefined> {
  const db = await getStore();
  return db.get("workouts", id);
}

export async function getAllStoredWorkouts(): Promise<StructuredWorkout[]> {
  const db = await getStore();
  return db.getAll("workouts");
}

export async function deleteStoredWorkout(id: string): Promise<boolean> {
  const db = await getStore();
  const existing = await db.get("workouts", id);
  if (!existing) return false;
  await db.delete("workouts", id);
  return true;
}
