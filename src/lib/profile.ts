import type { UserProfile } from "./types";
import {
  getStore,
  PROFILE_KEY,
  getAllStoredActivities,
  putActivity,
  type StoredActivity,
} from "./storage";
import { estimateActivityCalories, profileHasCalorieInputs } from "./calories";
import { isSupportedLanguage } from "./types";

export async function getUserProfile(): Promise<UserProfile | null> {
  const db = await getStore();
  const raw = await db.get("profile", PROFILE_KEY);
  if (!raw) return null;
  if (raw.language !== undefined && !isSupportedLanguage(raw.language)) {
    return { ...raw, language: undefined };
  }
  return raw;
}

export async function saveUserProfile(
  data: Omit<UserProfile, "updatedAt">
): Promise<UserProfile> {
  if (data.language !== undefined && !isSupportedLanguage(data.language)) {
    throw new Error("Perfil inválido: idioma não suportado.");
  }
  const profile: UserProfile = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  return saveUserProfileSnapshot(profile);
}

export async function saveUserProfileSnapshot(
  profile: UserProfile,
): Promise<UserProfile> {
  if (profile.language !== undefined && !isSupportedLanguage(profile.language)) {
    throw new Error("Perfil inválido: idioma não suportado.");
  }
  if (!Number.isFinite(new Date(profile.updatedAt).getTime())) {
    throw new Error("Perfil inválido: data de atualização inválida.");
  }
  const db = await getStore();
  await db.put("profile", profile, PROFILE_KEY);
  return profile;
}

/** Recalcula calorias estimadas em treinos que ainda não têm valor do relógio/import. */
export async function refreshEstimatedCalories(): Promise<number> {
  const profile = await getUserProfile();
  if (!profileHasCalorieInputs(profile)) return 0;

  const all = await getAllStoredActivities();
  let updated = 0;

  for (const activity of all) {
    if (activity.calories != null && activity.calories > 0) continue;

    const kcal = estimateActivityCalories(profile, {
      sport: activity.sport,
      durationSec: activity.durationSec,
      distanceM: activity.distanceM,
      avgPaceSecKm: activity.avgPaceSecKm,
      elevationGainM: activity.elevationGainM,
    });

    if (kcal != null) {
      const next: StoredActivity = { ...activity, calories: kcal };
      await putActivity(next);
      updated += 1;
    }
  }

  return updated;
}
