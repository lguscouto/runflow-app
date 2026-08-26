import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getStore,
  getStoredActivity,
  getStoredDashboardStats,
  putActivity,
  resetStoreForTesting,
} from "../storage";
import {
  applyIncomingPayload,
  assertValidSyncManifest,
  assertValidSyncPayload,
  mergeVaultWithLocal,
} from "./merger";
import {
  makeStoredActivity,
  makeStructuredWorkoutReport,
} from "../../../tests/fixtures/activityFactory";

describe("sync merger split-store contract", () => {
  beforeEach(async () => {
    await resetStoreForTesting(true);
  });

  afterEach(async () => {
    await resetStoreForTesting(true);
  });

  it("merges local and remote activities without duplicates and preserves detail data", async () => {
    const local = makeStoredActivity({ id: "sync-local" });
    const remoteReport = makeStructuredWorkoutReport({
      workoutId: "sync-remote-workout",
    });
    const remote = makeStoredActivity({
      id: "sync-remote",
      workoutId: "sync-remote-workout",
      structuredWorkoutReport: remoteReport,
    });
    const duplicateRemote = makeStoredActivity({
      id: local.id,
      name: "não deve substituir o local",
    });

    await putActivity(local);
    const { unifiedVault, report } = await mergeVaultWithLocal({
      profile: null,
      activities: [remote, duplicateRemote],
      gear: [],
      routes: [],
    });

    const unifiedActivities = unifiedVault.activities ?? [];
    expect(report.activitiesReceived).toBe(1);
    expect(report.activitiesSent).toBe(0);
    expect(unifiedActivities).toHaveLength(2);
    expect(new Set(unifiedActivities.map((item) => item.id)).size).toBe(2);
    expect(unifiedActivities.find((item) => item.id === local.id)?.name).toBe(
      local.name,
    );
    expect(unifiedActivities.find((item) => item.id === remote.id)?.structuredWorkoutReport).toEqual(
      remoteReport,
    );
    expect(await getStoredActivity(remote.id)).toEqual(remote);
  });

  it("rejects malformed remote activity before writing to IndexedDB", async () => {
    await expect(
      applyIncomingPayload({
        activities: [
          {
            id: "malformed",
            sport: "cycling",
            startedAt: new Date().toISOString(),
            durationSec: 10,
            distanceM: 10,
            points: [{ lat: 999, lng: 0 }],
          },
        ],
      }),
    ).rejects.toThrow(/payload|atividade|coordenadas/i);

    expect(await getStoredActivity("malformed")).toBeUndefined();
  });

  it("rejects invalid aggregate and point telemetry before writing", async () => {
    const activity = makeStoredActivity({ id: "invalid-telemetry" });
    await expect(
      applyIncomingPayload({
        activities: [{
          ...activity,
          avgWatts: Number.POSITIVE_INFINITY,
          points: [{ ...activity.points[0], hr: 400 }],
        }],
      }),
    ).rejects.toThrow(/payload|atividade|telemetria/i);

    expect(await getStoredActivity(activity.id)).toBeUndefined();
  });

  it("updates dashboard totals incrementally for direct sync writes", async () => {
    const local = makeStoredActivity({
      id: "sync-aggregate-local",
      distanceM: 2_000,
      durationSec: 600,
    });
    const remote = makeStoredActivity({
      id: "sync-aggregate-remote",
      distanceM: 5_000,
      durationSec: 1_800,
    });
    await putActivity(local);

    const getAllSpy = vi.spyOn(IDBObjectStore.prototype, "getAll");
    try {
      await applyIncomingPayload({ activities: [remote] });
      await applyIncomingPayload({
        activities: [{ ...remote, distanceM: 7_000, durationSec: 2_400 }],
      });
      expect(getAllSpy).not.toHaveBeenCalled();
    } finally {
      getAllSpy.mockRestore();
    }

    await expect(
      getStoredDashboardStats(Date.parse("2026-08-26T12:00:00.000Z")),
    ).resolves.toMatchObject({
      totalActivities: 2,
      totalDistanceM: 9_000,
      totalDurationSec: 3_000,
    });
  });

  it("preserves the remote profile updatedAt when applying a newer profile", async () => {
    const db = await getStore();
    await db.put(
      "profile",
      { name: "local", updatedAt: "2026-08-24T10:00:00.000Z" },
      "user",
    );

    const remoteProfile = {
      name: "remote",
      updatedAt: "2026-08-25T10:00:00.000Z",
    };
    await mergeVaultWithLocal({
      profile: remoteProfile,
      activities: [],
      gear: [],
      routes: [],
    });

    const saved = await db.get("profile", "user");
    expect(saved?.name).toBe("remote");
    expect(saved?.updatedAt).toBe(remoteProfile.updatedAt);
  });

  it("rejects a profile with an unsupported language before writing", () => {
    expect(() =>
      assertValidSyncPayload({
        profile: {
          language: "fr",
          updatedAt: new Date().toISOString(),
        },
      }),
    ).toThrow(/perfil|idioma|payload/i);
  });

  it("rejects oversized output payloads by cardinality", () => {
    const activity = makeStoredActivity({ id: "output-limit" });
    expect(() =>
      assertValidSyncPayload({
        activities: Array.from({ length: 1_001 }, (_, index) => ({
          ...activity,
          id: `output-${index}`,
        })),
      }),
    ).toThrow(/limite|excedida|payload/i);
  });

  it("rejects malformed manifests before calculating a delta", () => {
    expect(() =>
      assertValidSyncManifest({
        version: 1,
        deviceId: "remote",
        generatedAt: new Date().toISOString(),
        activities: [{ id: "missing-duration", startedAt: new Date().toISOString() }],
        gear: [],
        routes: [],
      }),
    ).toThrow(/manifesto|atividade/i);
  });

  it("rejects manifests with oversized identifiers", () => {
    expect(() =>
      assertValidSyncManifest({
        version: 1,
        deviceId: "remote",
        generatedAt: new Date().toISOString(),
        activities: [{
          id: "a".repeat(129),
          startedAt: new Date().toISOString(),
          durationSec: 1,
        }],
        gear: [],
        routes: [],
      }),
    ).toThrow(/manifesto|atividade|id/i);
  });
});
