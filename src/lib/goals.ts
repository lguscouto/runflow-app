import { getAllStoredSummaries } from "./storage";
import type { UserProfile } from "./types";

export interface WeeklyProgress {
  weekStart: string;
  weekEnd: string;
  distanceM: number;
  workoutCount: number;
  distanceGoalKm: number | null;
  workoutsGoal: number | null;
  distancePercent: number;
  workoutsPercent: number;
  distanceComplete: boolean;
  workoutsComplete: boolean;
  anyGoalSet: boolean;
  allGoalsComplete: boolean;
}

/** Segunda-feira 00:00 da semana atual (locale BR). */
export function getWeekStart(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekEnd(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 7);
  return end;
}

export async function getWeeklyProgress(
  profile: UserProfile | null
): Promise<WeeklyProgress> {
  const weekStart = getWeekStart();
  const weekEnd = getWeekEnd(weekStart);
  const all = await getAllStoredSummaries();

  let distanceM = 0;
  let workoutCount = 0;

  for (const a of all) {
    const t = new Date(a.startedAt).getTime();
    if (t >= weekStart.getTime() && t < weekEnd.getTime()) {
      distanceM += a.distanceM;
      workoutCount += 1;
    }
  }

  const distanceGoalKm = profile?.weeklyDistanceKm ?? null;
  const workoutsGoal = profile?.weeklyWorkouts ?? null;
  const anyGoalSet =
    (distanceGoalKm != null && distanceGoalKm > 0) ||
    (workoutsGoal != null && workoutsGoal > 0);

  const distanceKm = distanceM / 1000;
  let distancePercent = 0;
  let workoutsPercent = 0;

  if (distanceGoalKm != null && distanceGoalKm > 0) {
    distancePercent = Math.min(100, (distanceKm / distanceGoalKm) * 100);
  }
  if (workoutsGoal != null && workoutsGoal > 0) {
    workoutsPercent = Math.min(100, (workoutCount / workoutsGoal) * 100);
  }

  const distanceComplete =
    distanceGoalKm != null && distanceGoalKm > 0 && distanceKm >= distanceGoalKm;
  const workoutsComplete =
    workoutsGoal != null && workoutsGoal > 0 && workoutCount >= workoutsGoal;

  const completedFlags: boolean[] = [];
  if (distanceGoalKm != null && distanceGoalKm > 0) {
    completedFlags.push(distanceComplete);
  }
  if (workoutsGoal != null && workoutsGoal > 0) {
    completedFlags.push(workoutsComplete);
  }
  const allComplete =
    completedFlags.length > 0 && completedFlags.every(Boolean);

  return {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    distanceM,
    workoutCount,
    distanceGoalKm,
    workoutsGoal,
    distancePercent,
    workoutsPercent,
    distanceComplete,
    workoutsComplete,
    anyGoalSet,
    allGoalsComplete: allComplete,
  };
}
