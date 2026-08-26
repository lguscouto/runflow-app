import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  ActivityDetail,
  ActivitySummary,
  DashboardStats,
  Sport,
  TrackPoint,
  UserProfile,
  Gear,
  SavedRoute,
  StructuredWorkout,
  StructuredWorkoutReport,
} from "./types";
import {
  applyDashboardStatsDelta,
  computeDashboardStats,
  createDashboardStatsAggregate,
  dashboardStatsFromAggregate,
  getDashboardWeekStartMs,
  type DashboardStatsAggregate,
} from "./dashboard-stats";

export const PROFILE_KEY = "user";

export interface ActivityPageCursor {
  startedAt: string;
  id: string;
}

export interface ActivityPage {
  items: ActivitySummary[];
  nextCursor: ActivityPageCursor | null;
  hasMore: boolean;
}

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
  trackSegments?: StoredActivityTrack["points"][];
  maxPaceSecKm?: number | null;
  maxHr?: number | null;
  notes?: string | null;
  workoutId?: string | null;
  structuredWorkoutReport?: StructuredWorkoutReport | null;
}

export interface StoredActivity extends ActivitySummary {
  maxPaceSecKm: number | null;
  maxHr: number | null;
  notes: string | null;
  routeId?: string | null;
  workoutId?: string | null;
  structuredWorkoutReport?: StructuredWorkoutReport | null;
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
  trackSegments?: StoredActivity["points"][];
}

interface RunFlowDB extends DBSchema {
  activitySummaries: {
    key: string;
    value: ActivitySummary;
    indexes: {
      "by-started": string;
      "by-started-id": [string, string];
      "by-started-ms": number;
    };
  };
  activityTracks: {
    key: string;
    value: StoredActivityTrack;
  };
  dashboardStats: {
    key: string;
    value: DashboardStatsAggregate;
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
const DB_VERSION = 9;
export const DASHBOARD_STATS_KEY = "current";
const ACTIVITY_TRACK_READ_BATCH_SIZE = 32;

function assertLegacyActivity(value: unknown): asserts value is StoredActivity {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid legacy activity");
  }

  const activity = value as Partial<StoredActivity>;
  if (
    typeof activity.id !== "string" ||
    activity.id.length === 0 ||
    typeof activity.startedAt !== "string" ||
    activity.startedAt.length === 0 ||
    !Array.isArray(activity.points)
  ) {
    throw new Error(`Invalid legacy activity: ${activity.id ?? "unknown"}`);
  }
}

function getLegacyStructuredWorkoutReport(
  summary: ActivitySummary,
): StructuredWorkoutReport | null {
  const legacySummary = summary as ActivitySummary & {
    structuredWorkoutReport?: StructuredWorkoutReport | null;
  };
  return legacySummary.structuredWorkoutReport ?? null;
}

function stripLegacyStructuredWorkoutReport(summary: ActivitySummary): ActivitySummary {
  const legacySummary = summary as ActivitySummary & {
    structuredWorkoutReport?: StructuredWorkoutReport | null;
  };
  const hasLegacyReport = Object.prototype.hasOwnProperty.call(
    legacySummary,
    "structuredWorkoutReport",
  );
  const hasStartedAtMs = Object.prototype.hasOwnProperty.call(summary, "startedAtMs");
  if (!hasLegacyReport && !hasStartedAtMs) {
    return summary;
  }
  const {
    structuredWorkoutReport: _legacyReport,
    startedAtMs: _startedAtMs,
    ...lightweightSummary
  } = legacySummary;
  return lightweightSummary;
}

function stripInternalSummaryFields(summary: ActivitySummary): ActivitySummary {
  const { startedAtMs: _startedAtMs, ...publicSummary } = summary;
  return publicSummary;
}

let dbPromise: Promise<IDBPDatabase<RunFlowDB>> | null = null;

export function getStore(): Promise<IDBPDatabase<RunFlowDB>> {
  if (!dbPromise) {
    let migrationError: Error | null = null;
    dbPromise = openDB<RunFlowDB>(DB_NAME, DB_VERSION, {
      async upgrade(database, oldVersion, _newVersion, transaction) {
        // idb cria transaction.done ao envolver a transação. Em uma migração
        // abortada, consuma a rejeição dessa Promise para não gerar unhandled
        // rejection; a causa original continua sendo propagada por dbPromise.
        void transaction.done.catch(() => undefined);

        if (!database.objectStoreNames.contains("profile")) {
          database.createObjectStore("profile");
        }
        if (!database.objectStoreNames.contains("gear")) {
          database.createObjectStore("gear", { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains("routes")) {
          database.createObjectStore("routes", { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains("workouts")) {
          database.createObjectStore("workouts", { keyPath: "id" });
        }

        // Criação ou atualização dos stores split
        let summaryStore: any;
        if (!database.objectStoreNames.contains("activitySummaries")) {
          summaryStore = database.createObjectStore("activitySummaries", {
            keyPath: "id",
          });
          summaryStore.createIndex("by-started", "startedAt");
          summaryStore.createIndex("by-started-id", ["startedAt", "id"]);
          summaryStore.createIndex("by-started-ms", "startedAtMs");
        } else {
          summaryStore = transaction.objectStore("activitySummaries");
          if (!summaryStore.indexNames.contains("by-started-id")) {
            summaryStore.createIndex("by-started-id", ["startedAt", "id"]);
          }
          if (!summaryStore.indexNames.contains("by-started-ms")) {
            summaryStore.createIndex("by-started-ms", "startedAtMs");
          }
        }

        if (!database.objectStoreNames.contains("activityTracks")) {
          database.createObjectStore("activityTracks", { keyPath: "id" });
        }

        let dashboardStatsStore: any;
        if (!database.objectStoreNames.contains("dashboardStats")) {
          dashboardStatsStore = database.createObjectStore("dashboardStats");
        } else {
          dashboardStatsStore = transaction.objectStore("dashboardStats");
        }

        // Migração atômica de stores legados ('activities') para v9
        if (database.objectStoreNames.contains("activities" as any)) {
          try {
            const actStore = transaction.objectStore("activities" as any);
            const trackStore = transaction.objectStore("activityTracks");
            let cursor = await actStore.openCursor();
            while (cursor) {
              assertLegacyActivity(cursor.value);
              const act = cursor.value;

              const summary = toActivitySummary(act);
              const track: StoredActivityTrack = {
                id: act.id,
                points: act.points,
                maxPaceSecKm: act.maxPaceSecKm ?? null,
                maxHr: act.maxHr ?? null,
                notes: act.notes ?? null,
                workoutId: act.workoutId ?? null,
                structuredWorkoutReport: act.structuredWorkoutReport ?? null,
              };

              await summaryStore.put(summary);
              await trackStore.put(track);
              cursor = await cursor.continue();
            }

            // Eliminação segura do store legado após migração atômica completa
            database.deleteObjectStore("activities" as any);
          } catch (error) {
            migrationError =
              error instanceof Error ? error : new Error(String(error));
            transaction.abort();
          }
        }

        if (oldVersion < 9 && !migrationError) {
          const summaries = await summaryStore.getAll();
          for (const summary of summaries) {
            const startedAtMs = Date.parse(summary.startedAt);
            if (Number.isFinite(startedAtMs)) {
              await summaryStore.put({ ...summary, startedAtMs });
            }
          }
        }

        if (oldVersion < 8 && !migrationError) {
          const summaries = await summaryStore.getAll();
          await dashboardStatsStore.put(
            createDashboardStatsAggregate(summaries),
            DASHBOARD_STATS_KEY,
          );
        }
      },
    }).catch((error) => {
      const cause = migrationError ?? error;
      dbPromise = null;
      throw cause;
    });
  }
  return dbPromise;
}

/**
 * Helper para testes unitários fecharem e resetarem a conexão singleton do IndexedDB.
 */
export async function resetStoreForTesting(deleteDb = false): Promise<void> {
  const pendingDbPromise = dbPromise;
  dbPromise = null;

  if (pendingDbPromise) {
    try {
      const db = await pendingDbPromise;
      db.close();
    } catch {
      // A conexão pode ter falhado durante uma migration abortada. O singleton
      // já foi limpo acima para permitir uma nova tentativa isolada.
    }
  }

  if (deleteDb && typeof indexedDB !== "undefined") {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("database deletion blocked"));
    });
  }
}

export async function putActivity(activity: StoredActivity): Promise<void> {
  const db = await getStore();
  const summary = toActivitySummary(activity);
  const track: StoredActivityTrack = {
    id: activity.id,
    points: activity.points || [],
    trackSegments: activity.trackSegments,
    maxPaceSecKm: activity.maxPaceSecKm ?? null,
    maxHr: activity.maxHr ?? null,
    notes: activity.notes ?? null,
    workoutId: activity.workoutId ?? null,
    structuredWorkoutReport: activity.structuredWorkoutReport ?? null,
  };

  const tx = db.transaction(
    ["activitySummaries", "activityTracks", "dashboardStats"],
    "readwrite"
  );
  const summaryStore = tx.objectStore("activitySummaries");
  const statsStore = tx.objectStore("dashboardStats");
  const [previous, currentAggregate] = await Promise.all([
    summaryStore.get(activity.id),
    statsStore.get(DASHBOARD_STATS_KEY),
  ]);
  const aggregate =
    currentAggregate ?? createDashboardStatsAggregate(await summaryStore.getAll());
  const nextAggregate = applyDashboardStatsDelta(aggregate, previous, summary);

  await Promise.all([
    summaryStore.put(summary),
    tx.objectStore("activityTracks").put(track),
    statsStore.put(nextAggregate, DASHBOARD_STATS_KEY),
    tx.done,
  ]);
}

export async function getStoredActivity(
  id: string
): Promise<StoredActivity | undefined> {
  const db = await getStore();
  const [summary, track] = await Promise.all([
    db.get("activitySummaries", id),
    db.get("activityTracks", id),
  ]);

  if (!summary) return undefined;

  return {
    ...stripInternalSummaryFields(summary),
    points: track?.points || [],
    trackSegments: track?.trackSegments,
    maxPaceSecKm: track?.maxPaceSecKm ?? null,
    maxHr: track?.maxHr ?? null,
    notes: track?.notes ?? null,
    workoutId: track?.workoutId ?? summary.workoutId ?? null,
    structuredWorkoutReport:
      track?.structuredWorkoutReport ?? getLegacyStructuredWorkoutReport(summary),
  };
}

export async function getAllStoredActivities(): Promise<StoredActivity[]> {
  const db = await getStore();
  const tx = db.transaction(["activitySummaries", "activityTracks"], "readonly");
  const summaryIndex = tx.objectStore("activitySummaries").index("by-started");
  const trackStore = tx.objectStore("activityTracks");
  const summaries = await summaryIndex.getAll();

  // Reconstrução em lote ordenada por data descrescente
  const sortedSummaries = summaries.reverse();
  const results: StoredActivity[] = [];

  // Paraleliza cada lote sem enfileirar uma requisição por atividade do histórico.
  for (
    let offset = 0;
    offset < sortedSummaries.length;
    offset += ACTIVITY_TRACK_READ_BATCH_SIZE
  ) {
    const summaryBatch = sortedSummaries.slice(
      offset,
      offset + ACTIVITY_TRACK_READ_BATCH_SIZE,
    );
    const tracks = await Promise.all(
      summaryBatch.map((summary) => trackStore.get(summary.id)),
    );

    results.push(
      ...summaryBatch.map((summary, index) => {
        const track = tracks[index];
        return {
          ...stripInternalSummaryFields(summary),
          points: track?.points || [],
          trackSegments: track?.trackSegments,
          maxPaceSecKm: track?.maxPaceSecKm ?? null,
          maxHr: track?.maxHr ?? null,
          notes: track?.notes ?? null,
          workoutId: track?.workoutId ?? summary.workoutId ?? null,
          structuredWorkoutReport:
            track?.structuredWorkoutReport ?? getLegacyStructuredWorkoutReport(summary),
        };
      }),
    );
  }

  return results;
}

export async function countStoredActivities(): Promise<number> {
  const db = await getStore();
  return db.count("activitySummaries");
}

/**
 * Retorna todos os resumos de atividades diretamente do store dedicado `activitySummaries`
 * (sem carregar nem desserializar os arrays de trackpoints na heap do V8).
 */
export async function getAllStoredSummaries(): Promise<ActivitySummary[]> {
  const db = await getStore();
  const tx = db.transaction("activitySummaries", "readonly");
  const index = tx.store.index("by-started");
  const summaries = await index.getAll();
  return summaries.reverse().map(stripLegacyStructuredWorkoutReport);
}

/**
 * Retorna stats históricos a partir do agregado incremental e lê apenas a
 * janela móvel de sete dias para os indicadores semanais.
 */
export async function getStoredDashboardStats(now = Date.now()): Promise<DashboardStats> {
  const db = await getStore();
  const tx = db.transaction(["dashboardStats", "activitySummaries"], "readonly");
  const aggregate = await tx.objectStore("dashboardStats").get(DASHBOARD_STATS_KEY);
  if (!aggregate) {
    return computeDashboardStats(await tx.objectStore("activitySummaries").getAll(), now);
  }

  const recentSummaries = await tx.objectStore("activitySummaries")
    .index("by-started-ms")
    .getAll(IDBKeyRange.bound(getDashboardWeekStartMs(now), now));
  return dashboardStatsFromAggregate(aggregate, recentSummaries, now);
}

/**
 * Paginação estável por cursor determinístico combinando (startedAt, id)
 */
export async function listStoredActivitiesPaged(
  limit = 50,
  cursor?: ActivityPageCursor | null
): Promise<ActivityPage> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new RangeError("limit must be an integer between 1 and 200");
  }

  const db = await getStore();
  const tx = db.transaction("activitySummaries", "readonly");
  const index = tx.store.index("by-started-id");
  const items: ActivitySummary[] = [];
  const range = cursor
    ? IDBKeyRange.upperBound([cursor.startedAt, cursor.id], true)
    : null;

  let dbCursor = await index.openCursor(range, "prev");
  while (dbCursor && items.length < limit + 1) {
    items.push(stripLegacyStructuredWorkoutReport(dbCursor.value));
    dbCursor = await dbCursor.continue();
  }

  const hasMore = items.length > limit;
  const pageItems = hasMore ? items.slice(0, limit) : items;
  const lastItem = pageItems[pageItems.length - 1];
  const nextCursor: ActivityPageCursor | null =
    hasMore && lastItem
      ? { startedAt: lastItem.startedAt, id: lastItem.id }
      : null;

  return {
    items: pageItems,
    nextCursor,
    hasMore,
  };
}

export async function listStoredActivitiesWithCursor(
  limit = 50
): Promise<ActivitySummary[]> {
  const page = await listStoredActivitiesPaged(limit);
  return page.items;
}

export async function removeActivity(id: string): Promise<boolean> {
  const db = await getStore();
  const tx = db.transaction(
    ["activitySummaries", "activityTracks", "dashboardStats"],
    "readwrite"
  );
  const summaryStore = tx.objectStore("activitySummaries");
  const statsStore = tx.objectStore("dashboardStats");
  const [existing, currentAggregate] = await Promise.all([
    summaryStore.get(id),
    statsStore.get(DASHBOARD_STATS_KEY),
  ]);
  if (!existing) {
    await tx.done;
    return false;
  }

  const aggregate =
    currentAggregate ?? createDashboardStatsAggregate(await summaryStore.getAll());
  const nextAggregate = applyDashboardStatsDelta(aggregate, existing, undefined);

  await Promise.all([
    summaryStore.delete(id),
    tx.objectStore("activityTracks").delete(id),
    statsStore.put(nextAggregate, DASHBOARD_STATS_KEY),
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
  const toTrackPoint = (p: StoredActivity["points"][number]): TrackPoint => ({
    lat: p.lat,
    lng: p.lng,
    elevation: p.elevation,
    timestamp: p.timestamp ? new Date(p.timestamp) : undefined,
    hr: p.hr,
    watts: p.watts,
    cadence: p.cadence,
    speedKmh: p.speedKmh,
    grade: p.grade,
  });
  const points: TrackPoint[] = (stored.points || []).map(toTrackPoint);
  const trackSegments = stored.trackSegments?.map((segment) => segment.map(toTrackPoint));
  return {
    ...stored,
    points,
    trackSegments,
    movingTimeSec: (stored as any).movingTimeSec ?? stored.durationSec,
    elapsedTimeSec: (stored as any).elapsedTimeSec ?? stored.durationSec,
    routeId: (stored as any).routeId || null,
    workoutId: stored.workoutId || null,
    structuredWorkoutReport: stored.structuredWorkoutReport || null,
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
    workoutId,
  } = stored;
  const startedAtMs = Date.parse(startedAt);
  return {
    id,
    name,
    sport,
    startedAt,
    ...(Number.isFinite(startedAtMs) ? { startedAtMs } : {}),
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
    workoutId: workoutId || null,
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

// ── Structured Workouts ─────────────────────────────────────────────────────

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
