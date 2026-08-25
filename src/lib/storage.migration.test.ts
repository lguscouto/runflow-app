import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDB } from "idb";
import {
  getStore,
  getStoredActivity,
  getAllStoredSummaries,
  getAllStoredActivities,
  putActivity,
  resetStoreForTesting,
} from "./storage";
import { createLegacyDbV5 } from "../../tests/fixtures/legacyDbV5";
import { createLegacyDbV6 } from "../../tests/fixtures/legacyDbV6";
import {
  makeStoredActivity,
  makeStructuredWorkoutReport,
} from "../../tests/fixtures/activityFactory";

const DB_NAME = "runflow";

async function deleteDatabaseDirectly(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("database deletion blocked"));
  });
}

async function cleanupDatabase(): Promise<void> {
  await resetStoreForTesting(false).catch(() => undefined);
  await deleteDatabaseDirectly().catch(() => undefined);
}

async function createAlreadySplitV7DbWithLegacySummary(
  activity: ReturnType<typeof makeStoredActivity>,
): Promise<void> {
  const db = await openDB(DB_NAME, 7, {
    upgrade(database) {
      database.createObjectStore("profile");
      database.createObjectStore("gear", { keyPath: "id" });
      database.createObjectStore("routes", { keyPath: "id" });
      database.createObjectStore("workouts", { keyPath: "id" });
      const summaries = database.createObjectStore("activitySummaries", { keyPath: "id" });
      summaries.createIndex("by-started", "startedAt");
      summaries.createIndex("by-started-id", ["startedAt", "id"]);
      database.createObjectStore("activityTracks", { keyPath: "id" });
    },
  });

  const {
    points,
    maxPaceSecKm,
    maxHr,
    notes,
    structuredWorkoutReport,
    ...summaryFields
  } = activity;
  const tx = db.transaction(["activitySummaries", "activityTracks"], "readwrite");
  await tx.objectStore("activitySummaries").put({
    ...summaryFields,
    structuredWorkoutReport,
  });
  await tx.objectStore("activityTracks").put({
    id: activity.id,
    points,
    maxPaceSecKm,
    maxHr,
    notes,
    workoutId: activity.workoutId ?? null,
  });
  await tx.done;
  db.close();
}

async function readLegacyState() {
  const db = await openDB(DB_NAME);
  const activities = db.objectStoreNames.contains("activities")
    ? await db.getAll("activities")
    : [];
  const summaries = db.objectStoreNames.contains("activitySummaries")
    ? await db.getAll("activitySummaries")
    : [];
  const tracks = db.objectStoreNames.contains("activityTracks")
    ? await db.getAll("activityTracks")
    : [];
  const state = {
    version: db.version,
    stores: Array.from(db.objectStoreNames),
    activities,
    summaries,
    tracks,
  };
  db.close();
  return state;
}

describe("IndexedDB v7 Atomic Migration", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("rejects v5 migration when legacy points are corrupt and preserves the raw database", async () => {
    const valid = makeStoredActivity({ id: "v5-valid" });
    const corrupt = {
      ...makeStoredActivity({ id: "v5-corrupt" }),
      points: "corrompido",
    } as unknown as typeof valid;
    await createLegacyDbV5(DB_NAME, [valid, corrupt]);

    await expect(getStore()).rejects.toThrow(/invalid|corrupt|pontos/i);

    const state = await readLegacyState();
    expect(state.version).toBe(5);
    expect(state.stores).toContain("activities");
    expect(state.activities).toHaveLength(2);
    expect(state.activities.find((item) => item.id === "v5-corrupt")?.points).toBe(
      "corrompido",
    );
    expect(state.stores).not.toContain("activitySummaries");
    expect(state.stores).not.toContain("activityTracks");
  });

  it("allows a fresh open after a failed migration promise", async () => {
    const corrupt = {
      ...makeStoredActivity({ id: "v5-retry" }),
      points: "corrompido",
    } as unknown as ReturnType<typeof makeStoredActivity>;
    await createLegacyDbV5(DB_NAME, [corrupt]);

    await expect(getStore()).rejects.toThrow(/invalid|corrupt|pontos/i);
    await deleteDatabaseDirectly();
    await expect(getStore()).resolves.toBeDefined();
  });

  it("rejects v6 migration without replacing the original corrupt record or split state", async () => {
    const valid = makeStoredActivity({ id: "v6-valid" });
    const corrupt = {
      ...makeStoredActivity({ id: "v6-corrupt" }),
      points: "corrompido",
    } as unknown as typeof valid;
    await createLegacyDbV6(DB_NAME, [valid, corrupt]);
    const before = await readLegacyState();

    await expect(getStore()).rejects.toThrow(/invalid|corrupt|pontos/i);

    const after = await readLegacyState();
    expect(after.version).toBe(6);
    expect(after.stores).toContain("activities");
    expect(after.activities).toEqual(before.activities);
    expect(after.summaries).toEqual(before.summaries);
    expect(after.tracks).toEqual(before.tracks);
  });

  it("migrates from v5 legacy database losslessly", async () => {
    const report = makeStructuredWorkoutReport({ workoutId: "w-v5" });
    const legacyActivity = makeStoredActivity({
      id: "v5-activity-01",
      name: "Treino do Banco V5",
      workoutId: "w-v5",
      structuredWorkoutReport: report,
      notes: "Criado originalmente no schema v5",
    });

    // Cria banco no schema v5
    await createLegacyDbV5("runflow", [legacyActivity]);

    // Ao invocar as funções normais do app, o upgrade v7 é acionado
    const summaries = await getAllStoredSummaries();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].id).toBe("v5-activity-01");
    expect(summaries[0].name).toBe("Treino do Banco V5");

    const full = await getStoredActivity("v5-activity-01");
    expect(full).toBeDefined();
    expect(full?.workoutId).toBe("w-v5");
    expect(full?.notes).toBe("Criado originalmente no schema v5");
    expect(full?.structuredWorkoutReport).toEqual(report);
    expect(full?.points).toHaveLength(3);
  });

  it("migrates from v6 legacy database losslessly", async () => {
    const report = makeStructuredWorkoutReport({ workoutId: "w-v6" });
    const legacyActivity = makeStoredActivity({
      id: "v6-activity-01",
      name: "Treino do Banco V6",
      workoutId: "w-v6",
      structuredWorkoutReport: report,
    });

    // Cria banco no schema v6
    await createLegacyDbV6("runflow", [legacyActivity]);

    const full = await getStoredActivity("v6-activity-01");
    expect(full).toBeDefined();
    expect(full?.id).toBe("v6-activity-01");
    expect(full?.name).toBe("Treino do Banco V6");
  });

  it("preserves a structured report left in an already split v7 summary", async () => {
    const report = makeStructuredWorkoutReport({ workoutId: "w-v7-split" });
    const legacyActivity = makeStoredActivity({
      id: "v7-split-activity-01",
      workoutId: "w-v7-split",
      structuredWorkoutReport: report,
    });
    await createAlreadySplitV7DbWithLegacySummary(legacyActivity);

    const restored = await getStoredActivity(legacyActivity.id);
    expect(restored?.structuredWorkoutReport).toEqual(report);

    await putActivity(restored!);
    const db = await openDB(DB_NAME);
    const summary = await db.get("activitySummaries", legacyActivity.id);
    const track = await db.get("activityTracks", legacyActivity.id);
    db.close();

    expect(summary).not.toHaveProperty("structuredWorkoutReport");
    expect(track?.structuredWorkoutReport).toEqual(report);
  });

  it("reconstructs all stored activities correctly", async () => {
    const legacyActivity1 = makeStoredActivity({
      id: "act-batch-1",
      startedAt: "2026-08-24T10:00:00.000Z",
    });
    const legacyActivity2 = makeStoredActivity({
      id: "act-batch-2",
      startedAt: "2026-08-24T12:00:00.000Z",
    });

    await createLegacyDbV5("runflow", [legacyActivity1, legacyActivity2]);

    const all = await getAllStoredActivities();
    expect(all).toHaveLength(2);
    // Ordenado por startedAt desc
    expect(all[0].id).toBe("act-batch-2");
    expect(all[1].id).toBe("act-batch-1");
    expect(all[0].points).toBeDefined();
  });
});
