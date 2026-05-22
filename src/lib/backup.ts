import { getStore, PROFILE_KEY, type StoredActivity } from "./storage";
import type { UserProfile, Gear } from "./types";
import { shareOrDownloadFile } from "./share-file";

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
  const profile = (await db.get("profile", PROFILE_KEY)) || null;
  
  // Buscar equipamentos
  const gear = await db.getAll("gear");
  
  // Buscar todas as atividades
  const activities = await db.getAll("activities");

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
  let payload: BackupPayload;
  
  try {
    payload = JSON.parse(jsonString);
  } catch (err) {
    throw new Error("invalid_json");
  }

  // Validar se o formato é do RunFlow
  if (
    !payload ||
    !payload.metadata ||
    payload.metadata.appName !== "RunFlow" ||
    payload.metadata.version !== 1
  ) {
    throw new Error("invalid_backup_format");
  }

  const db = await getStore();
  let profileUpdated = false;

  // 1. Restaurar Perfil
  if (payload.profile) {
    await db.put("profile", payload.profile, PROFILE_KEY);
    profileUpdated = true;
  }

  // 2. Restaurar Gear (Equipamentos)
  let gearCount = 0;
  if (Array.isArray(payload.gear)) {
    for (const g of payload.gear) {
      await db.put("gear", g);
      gearCount++;
    }
  }

  // 3. Restaurar Atividades
  let activitiesCount = 0;
  if (Array.isArray(payload.activities)) {
    for (const act of payload.activities) {
      await db.put("activities", act);
      activitiesCount++;
    }
  }

  return {
    activitiesCount,
    gearCount,
    profileUpdated,
  };
}
