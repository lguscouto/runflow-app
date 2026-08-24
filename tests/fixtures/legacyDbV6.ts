import { openDB, type IDBPDatabase } from "idb";
import type { StoredActivity } from "@/lib/storage";
import { toActivitySummary } from "@/lib/storage";

export async function createLegacyDbV6(
  dbName = "runflow",
  activities: StoredActivity[] = []
): Promise<IDBPDatabase> {
  const db = await openDB(dbName, 6, {
    upgrade(database) {
      if (!database.objectStoreNames.contains("activities")) {
        const store = database.createObjectStore("activities", {
          keyPath: "id",
        });
        store.createIndex("by-started", "startedAt");
      }
      if (!database.objectStoreNames.contains("activitySummaries")) {
        const store = database.createObjectStore("activitySummaries", {
          keyPath: "id",
        });
        store.createIndex("by-started", "startedAt");
      }
      if (!database.objectStoreNames.contains("activityTracks")) {
        database.createObjectStore("activityTracks", { keyPath: "id" });
      }
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
    },
  });

  if (activities.length > 0) {
    const tx = db.transaction(
      ["activities", "activitySummaries", "activityTracks"],
      "readwrite"
    );
    for (const act of activities) {
      await tx.objectStore("activities").put(act);
      await tx.objectStore("activitySummaries").put(toActivitySummary(act));
      await tx.objectStore("activityTracks").put({
        id: act.id,
        points: act.points,
        maxPaceSecKm: act.maxPaceSecKm,
        maxHr: act.maxHr,
        notes: act.notes,
      });
    }
    await tx.done;
  }

  db.close();
  return db;
}
