import { startOfWeek, endOfWeek, subWeeks, startOfMonth, subMonths, format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import type { ActivitySummary, Sport } from "./types";

export type StatsPeriod = "4w" | "12w" | "year" | "all";
export type StatsSportFilter = "all" | Sport;

export interface AggregatedMetrics {
  totalDistanceM: number;
  totalDurationSec: number;
  avgPaceSecKm: number | null;
  totalWorkouts: number;
  totalCalories: number;
  avgHr: number | null;
}

export interface ChartBarData {
  label: string;
  distanceKm: number;
  durationMin: number;
  fullLabel: string;
}

export function filterActivities(
  activities: ActivitySummary[],
  period: StatsPeriod,
  sport: StatsSportFilter
): ActivitySummary[] {
  const today = new Date();
  let startLimit: Date | null = null;

  if (period === "4w") {
    startLimit = startOfWeek(subWeeks(today, 3), { weekStartsOn: 1 });
  } else if (period === "12w") {
    startLimit = startOfWeek(subWeeks(today, 11), { weekStartsOn: 1 });
  } else if (period === "year") {
    startLimit = new Date(today.getFullYear(), 0, 1);
  }

  return activities.filter((a) => {
    if (sport !== "all" && a.sport !== sport) {
      return false;
    }

    if (startLimit) {
      const aTime = new Date(a.startedAt).getTime();
      if (aTime < startLimit.getTime()) {
        return false;
      }
    }

    return true;
  });
}

export function calculateMetrics(activities: ActivitySummary[]): AggregatedMetrics {
  let totalDistanceM = 0;
  let totalDurationSec = 0;
  let totalCalories = 0;
  let hrWeightedSum = 0;
  let hrDurationSum = 0;
  const workoutsCount = activities.length;

  for (const a of activities) {
    totalDistanceM += a.distanceM;
    totalDurationSec += a.durationSec;
    totalCalories += a.calories ?? 0;
    if (a.avgHr != null && a.avgHr > 0) {
      hrWeightedSum += a.avgHr * a.durationSec;
      hrDurationSum += a.durationSec;
    }
  }

  const avgPaceSecKm = totalDistanceM > 0 ? (totalDurationSec / (totalDistanceM / 1000)) : null;
  const avgHr = hrDurationSum > 0 ? Math.round(hrWeightedSum / hrDurationSum) : null;

  return {
    totalDistanceM,
    totalDurationSec,
    avgPaceSecKm,
    totalWorkouts: workoutsCount,
    totalCalories,
    avgHr,
  };
}

export function getYearlyAccumulated(
  activities: ActivitySummary[],
  year: number
): { distanceKm: number; durationHours: number; workoutsCount: number } {
  const yearStart = new Date(year, 0, 1).getTime();
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999).getTime();

  let distanceM = 0;
  let durationSec = 0;
  let workoutsCount = 0;

  for (const a of activities) {
    const time = new Date(a.startedAt).getTime();
    if (time >= yearStart && time <= yearEnd) {
      distanceM += a.distanceM;
      durationSec += a.durationSec;
      workoutsCount++;
    }
  }

  return {
    distanceKm: parseFloat((distanceM / 1000).toFixed(1)),
    durationHours: parseFloat((durationSec / 3600).toFixed(1)),
    workoutsCount,
  };
}

function generateWeeks(count: number, language: "pt" | "en") {
  const locale = language === "en" ? enUS : ptBR;
  const weeks = [];
  const today = new Date();
  const currentMonday = startOfWeek(today, { weekStartsOn: 1 });

  for (let i = count - 1; i >= 0; i--) {
    const monday = subWeeks(currentMonday, i);
    const sunday = endOfWeek(monday, { weekStartsOn: 1 });

    const label = language === "en" ? format(monday, "MMM d", { locale }) : format(monday, "d/MMM", { locale });
    const startStr = language === "en" ? format(monday, "MMM d", { locale }) : format(monday, "d/MMM", { locale });
    const endStr = language === "en" ? format(sunday, "MMM d", { locale }) : format(sunday, "d/MMM", { locale });
    const fullLabel = `${startStr} - ${endStr}`;

    weeks.push({
      start: monday,
      end: sunday,
      label,
      fullLabel,
    });
  }
  return weeks;
}

function generateYearMonths(year: number, language: "pt" | "en") {
  const locale = language === "en" ? enUS : ptBR;
  const months = [];
  for (let m = 0; m < 12; m++) {
    const firstDay = new Date(year, m, 1);
    const lastDay = new Date(year, m + 1, 0, 23, 59, 59, 999);

    const label = format(firstDay, "MMM", { locale });
    const fullLabel = format(firstDay, "MMMM yyyy", { locale });

    months.push({
      start: firstDay,
      end: lastDay,
      label,
      fullLabel,
    });
  }
  return months;
}

function generateLast12Months(language: "pt" | "en") {
  const locale = language === "en" ? enUS : ptBR;
  const months = [];
  const today = new Date();
  const currentMonthFirstDay = startOfMonth(today);

  for (let i = 11; i >= 0; i--) {
    const firstDay = subMonths(currentMonthFirstDay, i);
    const lastDay = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0, 23, 59, 59, 999);

    const label = format(firstDay, "MMM", { locale });
    const fullLabel = format(firstDay, "MMMM yyyy", { locale });

    months.push({
      start: firstDay,
      end: lastDay,
      label,
      fullLabel,
    });
  }
  return months;
}

export function getChartData(
  activities: ActivitySummary[],
  period: StatsPeriod,
  language: "pt" | "en"
): ChartBarData[] {
  let intervals: Array<{ start: Date; end: Date; label: string; fullLabel: string }> = [];
  const today = new Date();

  if (period === "4w") {
    intervals = generateWeeks(4, language);
  } else if (period === "12w") {
    intervals = generateWeeks(12, language);
  } else if (period === "year") {
    intervals = generateYearMonths(today.getFullYear(), language);
  } else {
    intervals = generateLast12Months(language);
  }

  return intervals.map((interval) => {
    let distanceM = 0;
    let durationSec = 0;

    const startMs = interval.start.getTime();
    const endMs = interval.end.getTime();

    for (const a of activities) {
      const aTime = new Date(a.startedAt).getTime();
      if (aTime >= startMs && aTime <= endMs) {
        distanceM += a.distanceM;
        durationSec += a.durationSec;
      }
    }

    return {
      label: interval.label,
      distanceKm: parseFloat((distanceM / 1000).toFixed(2)),
      durationMin: Math.round(durationSec / 60),
      fullLabel: interval.fullLabel,
    };
  });
}
