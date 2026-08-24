import type { UserProfile } from "./types";
import {
  getStore,
  PROFILE_KEY,
  getAllStoredActivities,
  putActivity,
  type StoredActivity,
} from "./storage";
import { estimateActivityCalories, profileHasCalorieInputs } from "./calories";

export async function getUserProfile(): Promise<UserProfile | null> {
  const db = await getStore();
  const raw = await db.get("profile", PROFILE_KEY);
  return raw ?? null;
}

export async function saveUserProfile(
  data: Omit<UserProfile, "updatedAt">
): Promise<UserProfile> {
  const profile: UserProfile = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
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
