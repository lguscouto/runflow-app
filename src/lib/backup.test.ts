import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { openDB } from "idb";
import { exportBackup, importBackup } from "./backup";
import {
  getStore,
  getStoredActivity,
  PROFILE_KEY,
  putActivity,
  resetStoreForTesting,
} from "./storage";
import { shareOrDownloadFile } from "./share-file";
import {
  makeStoredActivity,
  makeStructuredWorkoutReport,
} from "../../tests/fixtures/activityFactory";

vi.mock("./share-file", () => ({
  shareOrDownloadFile: vi.fn().mockResolvedValue(undefined),
}));

describe("backup split-store contract", () => {
  beforeEach(async () => {
    await resetStoreForTesting(true);
    vi.mocked(shareOrDownloadFile).mockClear();
  });

  afterEach(async () => {
    await resetStoreForTesting(true);
  });

  it("exports, deletes and restores every detail field without summary duplication", async () => {
    const report = makeStructuredWorkoutReport({ workoutId: "backup-workout" });
    const activity = makeStoredActivity({
      id: "backup-activity",
      workoutId: "backup-workout",
      structuredWorkoutReport: report,
      notes: "backup note",
    });
    const gear = {
      id: "gear-backup",
      name: "Tênis sintético",
      initialDistanceM: 0,
      status: "active" as const,
      isDefault: false,
      createdAt: "2026-08-24T10:00:00.000Z",
    };

    await putActivity(activity);
    const db = await openDB("runflow");
    await db.put("gear", gear);
    db.close();

    await exportBackup();
    const [exportedJson] = vi.mocked(shareOrDownloadFile).mock.calls[0];
    const exported = JSON.parse(exportedJson as string);
    expect(exported.activities).toHaveLength(1);
    expect(exported.activities[0]).toEqual(activity);
    expect(exported.activities[0].structuredWorkoutReport).toEqual(report);

    await resetStoreForTesting(true);
    const result = await importBackup(JSON.stringify(exported));
    expect(result).toEqual({
      activitiesCount: 1,
      gearCount: 1,
      profileUpdated: false,
    });
    expect(await getStoredActivity(activity.id)).toEqual(activity);

    const restoredDb = await openDB("runflow");
    const summary = await restoredDb.get("activitySummaries", activity.id);
    const restoredGear = await restoredDb.get("gear", gear.id);
    restoredDb.close();
    expect(summary).not.toHaveProperty("structuredWorkoutReport");
    expect(restoredGear).toEqual(gear);
  });

  it("rejects the complete payload before writing any record", async () => {
    const gear = {
      id: "gear-invalid-import",
      name: "Equipamento sintético",
      initialDistanceM: 0,
      status: "active" as const,
      isDefault: false,
      createdAt: "2026-08-24T10:00:00.000Z",
    };
    const activity = makeStoredActivity({ id: "activity-invalid-import" });
    const invalidActivity = { ...activity, points: "not-an-array" };
    const payload = {
      metadata: {
        appName: "RunFlow",
        version: 1,
        exportedAt: "2026-08-24T10:00:00.000Z",
      },
      profile: null,
      gear: [gear],
      activities: [invalidActivity],
    };

    await expect(importBackup(JSON.stringify(payload))).rejects.toThrow(/inválid/i);

    const db = await getStore();
    expect(await db.get("gear", gear.id)).toBeUndefined();
    expect(await getStoredActivity(activity.id)).toBeUndefined();
    db.close();
  });

  it("exports a sanitized legacy profile that can round-trip through import", async () => {
    const db = await getStore();
    await db.put(
      "profile",
      {
        name: "Perfil legado",
        language: "fr",
        updatedAt: "2026-08-24T10:00:00.000Z",
      } as never,
      PROFILE_KEY,
    );

    await exportBackup();
    const [exportedJson] = vi.mocked(shareOrDownloadFile).mock.calls[0];
    const exported = JSON.parse(exportedJson as string);

    expect(exported.profile).toEqual({
      name: "Perfil legado",
      updatedAt: "2026-08-24T10:00:00.000Z",
    });

    await resetStoreForTesting(true);
    await expect(importBackup(JSON.stringify(exported))).resolves.toMatchObject({
      profileUpdated: true,
    });
  });
});
