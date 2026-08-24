import { openDB, type IDBPDatabase } from "idb";
import type { StoredActivity } from "@/lib/storage";

export async function createLegacyDbV5(
  dbName = "runflow",
  activities: StoredActivity[] = []
): Promise<IDBPDatabase> {
  const db = await openDB(dbName, 5, {
    upgrade(database) {
      if (!database.objectStoreNames.contains("activities")) {
        const store = database.createObjectStore("activities", {
          keyPath: "id",
        });
        store.createIndex("by-started", "startedAt");
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
    const tx = db.transaction("activities", "readwrite");
    for (const act of activities) {
      await tx.store.put(act);
    }
    await tx.done;
  }

  db.close();
  return db;
}
