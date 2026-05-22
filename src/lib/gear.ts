import { getAllStoredGear, getAllStoredActivities, putGear, getStoredActivity, putActivity } from "./storage";
import type { Gear } from "./types";

export interface GearWithUsage extends Gear {
  accumulatedDistanceM: number;
}

export async function listGearWithUsage(): Promise<GearWithUsage[]> {
  const gears = await getAllStoredGear();
  const activities = await getAllStoredActivities();

  // Calculate distance sum for each gear
  const distanceByGear = new Map<string, number>();
  for (const act of activities) {
    if (act.gearId) {
      const current = distanceByGear.get(act.gearId) || 0;
      distanceByGear.set(act.gearId, current + act.distanceM);
    }
  }

  return gears.map((gear) => {
    const activityDist = distanceByGear.get(gear.id) || 0;
    return {
      ...gear,
      accumulatedDistanceM: gear.initialDistanceM + activityDist,
    };
  });
}

export async function setDefaultGear(id: string | null): Promise<void> {
  const gears = await getAllStoredGear();
  for (const gear of gears) {
    gear.isDefault = gear.id === id;
    await putGear(gear);
  }
}

export async function associateGearToActivity(activityId: string, gearId: string | null): Promise<void> {
  const activity = await getStoredActivity(activityId);
  if (activity) {
    activity.gearId = gearId;
    await putActivity(activity);
  }
}
