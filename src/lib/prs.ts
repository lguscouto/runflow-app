import { ActivitySummary, UserProfile } from "./types";

export interface PersonalRecords {
  longestDistance: ActivitySummary | null;
  bestPace: ActivitySummary | null;
  longestDuration: ActivitySummary | null;
  highestElevation: ActivitySummary | null;
}

export type PRCategory = "longestDistance" | "bestPace" | "longestDuration" | "highestElevation";

export const PR_CATEGORY_LABELS: Record<PRCategory, string> = {
  longestDistance: "Maior Distância",
  bestPace: "Melhor Ritmo Médio",
  longestDuration: "Maior Duração",
  highestElevation: "Maior Ganho de Elevação",
};

/**
 * Analisa as atividades (somente de corrida) e determina os recordes pessoais (PRs).
 */
export function getPersonalRecords(
  activities: ActivitySummary[],
  profile: UserProfile | null
): PersonalRecords {
  const rawMinDistance = profile?.prMinPaceDistanceKm;
  const minDistanceKm = (rawMinDistance !== undefined && rawMinDistance > 0) ? rawMinDistance : 5;
  const minDistanceM = minDistanceKm * 1000;

  // Filtrar apenas treinos de corrida
  const runningActivities = activities.filter((a) => a.sport === "running");

  let longestDistance: ActivitySummary | null = null;
  let bestPace: ActivitySummary | null = null;
  let longestDuration: ActivitySummary | null = null;
  let highestElevation: ActivitySummary | null = null;

  for (const act of runningActivities) {
    // 1. Maior Distância
    if (!longestDistance || act.distanceM > longestDistance.distanceM) {
      longestDistance = act;
    }

    // 2. Melhor Ritmo (menor valor em segundos/km é o mais rápido)
    if (act.distanceM >= minDistanceM && act.avgPaceSecKm !== null && act.avgPaceSecKm > 0) {
      if (!bestPace || act.avgPaceSecKm < (bestPace.avgPaceSecKm ?? Infinity)) {
        bestPace = act;
      }
    }

    // 3. Maior Duração
    if (!longestDuration || act.durationSec > longestDuration.durationSec) {
      longestDuration = act;
    }

    // 4. Maior Elevação
    if (act.elevationGainM !== null && act.elevationGainM > 0) {
      if (!highestElevation || act.elevationGainM > (highestElevation.elevationGainM ?? 0)) {
        highestElevation = act;
      }
    }
  }

  return {
    longestDistance,
    bestPace,
    longestDuration,
    highestElevation,
  };
}

export interface ActivityPRResult {
  isPR: boolean;
  categories: PRCategory[];
}

/**
 * Verifica se uma atividade específica bateu algum recorde pessoal.
 */
export function getActivityPRs(
  activityId: string,
  prs: PersonalRecords
): ActivityPRResult {
  const categories: PRCategory[] = [];

  if (prs.longestDistance?.id === activityId) {
    categories.push("longestDistance");
  }
  if (prs.bestPace?.id === activityId) {
    categories.push("bestPace");
  }
  if (prs.longestDuration?.id === activityId) {
    categories.push("longestDuration");
  }
  if (prs.highestElevation?.id === activityId) {
    categories.push("highestElevation");
  }

  return {
    isPR: categories.length > 0,
    categories,
  };
}

/**
 * Constrói um mapeamento de ID da atividade para as categorias de PR obtidas.
 */
export function getPRMap(
  activities: ActivitySummary[],
  prs: PersonalRecords
): Record<string, PRCategory[]> {
  const map: Record<string, PRCategory[]> = {};

  if (prs.longestDistance) {
    if (!map[prs.longestDistance.id]) map[prs.longestDistance.id] = [];
    map[prs.longestDistance.id].push("longestDistance");
  }
  if (prs.bestPace) {
    if (!map[prs.bestPace.id]) map[prs.bestPace.id] = [];
    map[prs.bestPace.id].push("bestPace");
  }
  if (prs.longestDuration) {
    if (!map[prs.longestDuration.id]) map[prs.longestDuration.id] = [];
    map[prs.longestDuration.id].push("longestDuration");
  }
  if (prs.highestElevation) {
    if (!map[prs.highestElevation.id]) map[prs.highestElevation.id] = [];
    map[prs.highestElevation.id].push("highestElevation");
  }

  return map;
}
