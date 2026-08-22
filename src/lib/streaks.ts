import { startOfISOWeek, endOfISOWeek, subWeeks, isSameISOWeek, format, getISODay } from "date-fns";
import type { ActivitySummary } from "./types";

export interface ConsistencyStreakInfo {
  currentStreakWeeks: number;
  longestStreakWeeks: number;
  thisWeekCount: number;
  thisWeekDistanceM: number;
  isThisWeekCompleted: boolean;
  activeDaysThisWeek: boolean[]; // 7 booleans: Mon=0 .. Sun=6
  streakTitleKey: string;
  flameLevel: "inactive" | "warm" | "fire" | "blaze" | "legend";
}

/**
 * Calcula a consistência semanal (Streaks) do corredor a partir do histórico de atividades.
 */
export function calculateConsistencyStreaks(
  activities: ActivitySummary[],
  now: Date = new Date()
): ConsistencyStreakInfo {
  if (!activities || activities.length === 0) {
    return {
      currentStreakWeeks: 0,
      longestStreakWeeks: 0,
      thisWeekCount: 0,
      thisWeekDistanceM: 0,
      isThisWeekCompleted: false,
      activeDaysThisWeek: [false, false, false, false, false, false, false],
      streakTitleKey: "streaks.level_start",
      flameLevel: "inactive",
    };
  }

  // Mapear datas válidas das atividades
  const activityDates: { date: Date; distanceM: number }[] = activities
    .map((a) => ({
      date: new Date(a.startedAt),
      distanceM: a.distanceM || 0,
    }))
    .filter((item) => !isNaN(item.date.getTime()))
    .sort((a, b) => b.date.getTime() - a.date.getTime()); // Decrescente

  const currentWeekStart = startOfISOWeek(now);
  const currentWeekEnd = endOfISOWeek(now);

  // Atividades desta semana
  const thisWeekActivities = activityDates.filter(
    (a) => a.date >= currentWeekStart && a.date <= currentWeekEnd
  );
  const thisWeekCount = thisWeekActivities.length;
  const thisWeekDistanceM = thisWeekActivities.reduce((acc, a) => acc + a.distanceM, 0);
  const isThisWeekCompleted = thisWeekCount > 0;

  // Dias ativos na semana atual (0 = Segunda, 6 = Domingo)
  const activeDaysThisWeek = [false, false, false, false, false, false, false];
  for (const act of thisWeekActivities) {
    const isoDay = getISODay(act.date); // 1 = Monday .. 7 = Sunday
    const dayIdx = isoDay - 1;
    if (dayIdx >= 0 && dayIdx <= 6) {
      activeDaysThisWeek[dayIdx] = true;
    }
  }

  // Agrupar atividades por semanas ISO (formato "yyyy-II")
  const weekSet = new Set<string>();
  for (const act of activityDates) {
    weekSet.add(format(act.date, "yyyy-RR"));
  }

  // Calcular current streak
  let currentStreakWeeks = 0;
  let checkWeekDate = currentWeekStart;

  // Se já treinou esta semana, começa contando a semana atual
  if (isThisWeekCompleted) {
    while (weekSet.has(format(checkWeekDate, "yyyy-RR"))) {
      currentStreakWeeks++;
      checkWeekDate = subWeeks(checkWeekDate, 1);
    }
  } else {
    // Se ainda não treinou nesta semana, verifica se treinou na semana anterior
    const lastWeekDate = subWeeks(currentWeekStart, 1);
    if (weekSet.has(format(lastWeekDate, "yyyy-RR"))) {
      checkWeekDate = lastWeekDate;
      while (weekSet.has(format(checkWeekDate, "yyyy-RR"))) {
        currentStreakWeeks++;
        checkWeekDate = subWeeks(checkWeekDate, 1);
      }
    } else {
      currentStreakWeeks = 0;
    }
  }

  // Calcular longest streak histórico
  let longestStreakWeeks = currentStreakWeeks;
  if (activityDates.length > 0) {
    const oldestDate = activityDates[activityDates.length - 1].date;
    let scanDate = startOfISOWeek(oldestDate);
    const endDate = currentWeekStart;
    let tempStreak = 0;

    while (scanDate <= endDate) {
      if (weekSet.has(format(scanDate, "yyyy-RR"))) {
        tempStreak++;
        if (tempStreak > longestStreakWeeks) {
          longestStreakWeeks = tempStreak;
        }
      } else {
        tempStreak = 0;
      }
      scanDate = subWeeks(scanDate, -1); // +1 semana
    }
  }

  // Definir nível da chama
  let flameLevel: "inactive" | "warm" | "fire" | "blaze" | "legend" = "inactive";
  let streakTitleKey = "streaks.level_start";

  if (currentStreakWeeks >= 12) {
    flameLevel = "legend";
    streakTitleKey = "streaks.level_legend";
  } else if (currentStreakWeeks >= 6) {
    flameLevel = "blaze";
    streakTitleKey = "streaks.level_blaze";
  } else if (currentStreakWeeks >= 3) {
    flameLevel = "fire";
    streakTitleKey = "streaks.level_fire";
  } else if (currentStreakWeeks >= 1) {
    flameLevel = "warm";
    streakTitleKey = "streaks.level_warm";
  }

  return {
    currentStreakWeeks,
    longestStreakWeeks,
    thisWeekCount,
    thisWeekDistanceM,
    isThisWeekCompleted,
    activeDaysThisWeek,
    streakTitleKey,
    flameLevel,
  };
}
