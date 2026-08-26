import type { ActivitySummary, DashboardStats } from "./types";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface DashboardStatsAggregate {
  totalActivities: number;
  totalDistanceM: number;
  totalDurationSec: number;
}

export function emptyDashboardStatsAggregate(): DashboardStatsAggregate {
  return {
    totalActivities: 0,
    totalDistanceM: 0,
    totalDurationSec: 0,
  };
}

export function createDashboardStatsAggregate(
  summaries: readonly ActivitySummary[],
): DashboardStatsAggregate {
  const aggregate = emptyDashboardStatsAggregate();
  for (const summary of summaries) {
    addSummaryToAggregate(aggregate, summary, 1);
  }
  return aggregate;
}

export function applyDashboardStatsDelta(
  aggregate: DashboardStatsAggregate,
  previous: ActivitySummary | undefined,
  next: ActivitySummary | undefined,
): DashboardStatsAggregate {
  const updated = { ...aggregate };
  if (previous) addSummaryToAggregate(updated, previous, -1);
  if (next) addSummaryToAggregate(updated, next, 1);
  return updated;
}

export function dashboardStatsFromAggregate(
  aggregate: DashboardStatsAggregate,
  recentSummaries: readonly ActivitySummary[],
  now = Date.now(),
): DashboardStats {
  const weekAgo = now - WEEK_MS;
  let thisWeekDistanceM = 0;
  let thisWeekActivities = 0;

  for (const summary of recentSummaries) {
    const startedAtMs = getSummaryStartedAtMs(summary);
    if (!(startedAtMs >= weekAgo && startedAtMs <= now)) continue;
    thisWeekDistanceM += summary.distanceM;
    thisWeekActivities += 1;
  }

  return {
    ...aggregate,
    thisWeekDistanceM,
    thisWeekActivities,
  };
}

/**
 * Compatibilidade para consumidores que já têm todos os resumos em memória.
 * O dashboard usa o agregado persistido; esta função permanece pura para
 * analytics, migrações e consumidores externos existentes.
 */
export function computeDashboardStats(
  summaries: readonly ActivitySummary[],
  now = Date.now(),
): DashboardStats {
  const aggregate = createDashboardStatsAggregate(summaries);
  const weekAgo = now - WEEK_MS;
  const recent = summaries.filter(
    (summary) => {
      const startedAtMs = getSummaryStartedAtMs(summary);
      return startedAtMs >= weekAgo && startedAtMs <= now;
    },
  );
  return dashboardStatsFromAggregate(aggregate, recent, now);
}

export function getDashboardWeekStartMs(now = Date.now()): number {
  return now - WEEK_MS;
}

function getSummaryStartedAtMs(summary: ActivitySummary): number {
  return summary.startedAtMs ?? Date.parse(summary.startedAt);
}

function addSummaryToAggregate(
  aggregate: DashboardStatsAggregate,
  summary: ActivitySummary,
  direction: 1 | -1,
): void {
  aggregate.totalActivities += direction;
  aggregate.totalDistanceM += direction * summary.distanceM;
  aggregate.totalDurationSec += direction * summary.durationSec;
}
