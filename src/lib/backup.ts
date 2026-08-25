import {
  getStore,
  PROFILE_KEY,
  getAllStoredActivities,
  toActivitySummary,
  type StoredActivityTrack,
  type StoredActivity,
} from "./storage";
import type { UserProfile, Gear } from "./types";
import { getUserProfile } from "./profile";
import { shareOrDownloadFile } from "./share-file";
import { assertValidSyncPayload } from "./sync/merger";

export interface BackupPayload {
  metadata: {
    appName: string;
    version: number;
    exportedAt: string;
  };
  profile: UserProfile | null;
  gear: Gear[];
  activities: StoredActivity[];
}

export async function exportBackup(): Promise<void> {
  const db = await getStore();
  
  // Buscar perfil
  const profile = await getUserProfile();
  
  // Buscar equipamentos
  const gear = await db.getAll("gear");
  
  // Buscar todas as atividades reconstruídas
  const activities = await getAllStoredActivities();

  const payload: BackupPayload = {
    metadata: {
      appName: "RunFlow",
      version: 1,
      exportedAt: new Date().toISOString(),
    },
    profile,
    gear,
    activities,
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `runflow-backup-${dateStr}.json`;

  // Disparar o download (Web) ou partilha nativa (Capacitor)
  await shareOrDownloadFile(jsonString, filename, "application/json");
}

export interface ImportResult {
  activitiesCount: number;
  gearCount: number;
  profileUpdated: boolean;
}

export async function importBackup(jsonString: string): Promise<ImportResult> {
  let payload: unknown;
  
  try {
    payload = JSON.parse(jsonString);
  } catch (err) {
    throw new Error("invalid_json");
  }

  // Validar se o formato é do RunFlow
  if (!payload || typeof payload !== "object") {
    throw new Error("invalid_backup_format");
  }
  const candidate = payload as Partial<BackupPayload>;
  if (
    !candidate.metadata ||
    candidate.metadata.appName !== "RunFlow" ||
    candidate.metadata.version !== 1 ||
    typeof candidate.metadata.exportedAt !== "string" ||
    !Number.isFinite(new Date(candidate.metadata.exportedAt).getTime()) ||
    !Array.isArray(candidate.gear) ||
    !Array.isArray(candidate.activities)
  ) throw new Error("invalid_backup_format");

  assertValidSyncPayload({
    profile: candidate.profile ?? null,
    gear: candidate.gear,
    activities: candidate.activities,
  });
  const validPayload = candidate as BackupPayload;

  const db = await getStore();
  let profileUpdated = false;

  const tx = db.transaction(["profile", "gear", "activitySummaries", "activityTracks"], "readwrite");
  if (validPayload.profile) {
    tx.objectStore("profile").put(validPayload.profile, PROFILE_KEY);
    profileUpdated = true;
  }
  for (const g of validPayload.gear) tx.objectStore("gear").put(g);
  for (const activity of validPayload.activities) {
    const track: StoredActivityTrack = {
      id: activity.id,
      points: activity.points,
      trackSegments: activity.trackSegments,
      maxPaceSecKm: activity.maxPaceSecKm,
      maxHr: activity.maxHr,
      notes: activity.notes,
      workoutId: activity.workoutId,
      structuredWorkoutReport: activity.structuredWorkoutReport,
    };
    tx.objectStore("activitySummaries").put(toActivitySummary(activity));
    tx.objectStore("activityTracks").put(track);
  }
  await tx.done;

  return {
    activitiesCount: validPayload.activities.length,
    gearCount: validPayload.gear.length,
    profileUpdated,
  };
}
