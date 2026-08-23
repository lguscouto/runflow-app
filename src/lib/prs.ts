import { ActivitySummary, Sport, UserProfile } from "./types";

export interface RunningPersonalRecords {
  longestDistance: ActivitySummary | null;
  bestPace: ActivitySummary | null;
  longestDuration: ActivitySummary | null;
  highestElevation: ActivitySummary | null;
}

export interface CyclingPersonalRecords {
  longestDistance: ActivitySummary | null;
  highestAvgSpeed: ActivitySummary | null;
  maxSpeed: ActivitySummary | null;
  highestElevation: ActivitySummary | null;
  bestPower: ActivitySummary | null;
  longestDuration: ActivitySummary | null;
}

export interface PersonalRecords {
  running: RunningPersonalRecords;
  cycling: CyclingPersonalRecords;
  // Legacy aliases for running backward compatibility
  longestDistance: ActivitySummary | null;
  bestPace: ActivitySummary | null;
  longestDuration: ActivitySummary | null;
  highestElevation: ActivitySummary | null;
}

export type PRCategory =
  | "longestDistance"
  | "bestPace"
  | "longestDuration"
  | "highestElevation"
  | "highestAvgSpeed"
  | "maxSpeed"
  | "bestPower";

export const PR_CATEGORY_LABELS: Record<PRCategory, string> = {
  longestDistance: "Maior Distância",
  bestPace: "Melhor Ritmo Médio",
  longestDuration: "Maior Duração",
  highestElevation: "Maior Ganho de Elevação",
  highestAvgSpeed: "Maior Velocidade Média",
  maxSpeed: "Velocidade Máxima",
  bestPower: "Melhor Potência Média",
};

/**
 * Analisa as atividades e determina os recordes pessoais (PRs) separados por modalidade (Corrida e Ciclismo).
 */
export function getPersonalRecords(
  activities: ActivitySummary[],
  profile: UserProfile | null
): PersonalRecords {
  const rawMinDistance = profile?.prMinPaceDistanceKm;
  const minDistanceKm = rawMinDistance !== undefined && rawMinDistance > 0 ? rawMinDistance : 5;
  const minDistanceM = minDistanceKm * 1000;

  // 1. Corrida (Running)
  const runningActs = activities.filter((a) => a.sport === "running");
  let runLongestDist: ActivitySummary | null = null;
  let runBestPace: ActivitySummary | null = null;
  let runLongestDur: ActivitySummary | null = null;
  let runHighestEle: ActivitySummary | null = null;

  for (const act of runningActs) {
    if (!runLongestDist || act.distanceM > runLongestDist.distanceM) {
      runLongestDist = act;
    }
    if (act.distanceM >= minDistanceM && act.avgPaceSecKm != null && act.avgPaceSecKm > 0) {
      if (!runBestPace || act.avgPaceSecKm < (runBestPace.avgPaceSecKm ?? Infinity)) {
        runBestPace = act;
      }
    }
    if (!runLongestDur || act.durationSec > runLongestDur.durationSec) {
      runLongestDur = act;
    }
    if (act.elevationGainM != null && act.elevationGainM > 0) {
      if (!runHighestEle || act.elevationGainM > (runHighestEle.elevationGainM ?? 0)) {
        runHighestEle = act;
      }
    }
  }

  // 2. Ciclismo (Cycling)
  const cyclingActs = activities.filter((a) => a.sport === "cycling");
  let bikeLongestDist: ActivitySummary | null = null;
  let bikeHighestAvgSpeed: ActivitySummary | null = null;
  let bikeMaxSpeed: ActivitySummary | null = null;
  let bikeHighestEle: ActivitySummary | null = null;
  let bikeBestPower: ActivitySummary | null = null;
  let bikeLongestDur: ActivitySummary | null = null;

  for (const act of cyclingActs) {
    // Maior distância
    if (!bikeLongestDist || act.distanceM > bikeLongestDist.distanceM) {
      bikeLongestDist = act;
    }
    // Maior velocidade média (em pedais >= 10 km)
    if (act.distanceM >= 10000 && act.avgSpeedKmh != null && act.avgSpeedKmh > 0) {
      if (!bikeHighestAvgSpeed || act.avgSpeedKmh > (bikeHighestAvgSpeed.avgSpeedKmh ?? 0)) {
        bikeHighestAvgSpeed = act;
      }
    }
    // Velocidade máxima registrada
    if (act.maxSpeedKmh != null && act.maxSpeedKmh > 0) {
      if (!bikeMaxSpeed || act.maxSpeedKmh > (bikeMaxSpeed.maxSpeedKmh ?? 0)) {
        bikeMaxSpeed = act;
      }
    }
    // Maior altimetria acumulada
    if (act.elevationGainM != null && act.elevationGainM > 0) {
      if (!bikeHighestEle || act.elevationGainM > (bikeHighestEle.elevationGainM ?? 0)) {
        bikeHighestEle = act;
      }
    }
    // Melhor potência média (em pedais >= 10 min)
    if (act.durationSec >= 600 && act.avgWatts != null && act.avgWatts > 0) {
      if (!bikeBestPower || act.avgWatts > (bikeBestPower.avgWatts ?? 0)) {
        bikeBestPower = act;
      }
    }
    // Maior duração
    if (!bikeLongestDur || act.durationSec > bikeLongestDur.durationSec) {
      bikeLongestDur = act;
    }
  }

  const runningPRs: RunningPersonalRecords = {
    longestDistance: runLongestDist,
    bestPace: runBestPace,
    longestDuration: runLongestDur,
    highestElevation: runHighestEle,
  };

  const cyclingPRs: CyclingPersonalRecords = {
    longestDistance: bikeLongestDist,
    highestAvgSpeed: bikeHighestAvgSpeed,
    maxSpeed: bikeMaxSpeed,
    highestElevation: bikeHighestEle,
    bestPower: bikeBestPower,
    longestDuration: bikeLongestDur,
  };

  return {
    running: runningPRs,
    cycling: cyclingPRs,
    // Aliases
    longestDistance: runLongestDist,
    bestPace: runBestPace,
    longestDuration: runLongestDur,
    highestElevation: runHighestEle,
  };
}

export interface ActivityPRResult {
  isPR: boolean;
  categories: PRCategory[];
}

/**
 * Verifica se uma atividade específica bateu algum recorde pessoal na sua modalidade.
 */
export function getActivityPRs(
  activityId: string,
  prs: PersonalRecords,
  sport?: Sport
): ActivityPRResult {
  const categories: PRCategory[] = [];

  if (sport === "cycling" || !sport) {
    if (prs.cycling.longestDistance?.id === activityId) categories.push("longestDistance");
    if (prs.cycling.highestAvgSpeed?.id === activityId) categories.push("highestAvgSpeed");
    if (prs.cycling.maxSpeed?.id === activityId) categories.push("maxSpeed");
    if (prs.cycling.highestElevation?.id === activityId) categories.push("highestElevation");
    if (prs.cycling.bestPower?.id === activityId) categories.push("bestPower");
    if (prs.cycling.longestDuration?.id === activityId) categories.push("longestDuration");
  }

  if (sport === "running" || (!sport && categories.length === 0)) {
    if (prs.running.longestDistance?.id === activityId) categories.push("longestDistance");
    if (prs.running.bestPace?.id === activityId) categories.push("bestPace");
    if (prs.running.longestDuration?.id === activityId) categories.push("longestDuration");
    if (prs.running.highestElevation?.id === activityId) categories.push("highestElevation");
  }

  return {
    isPR: categories.length > 0,
    categories,
  };
}

/**
 * Constrói um mapeamento de ID da atividade para as categorias de PR obtidas em qualquer esporte.
 */
export function getPRMap(
  activities: ActivitySummary[],
  prs: PersonalRecords
): Record<string, PRCategory[]> {
  const map: Record<string, PRCategory[]> = {};

  const register = (act: ActivitySummary | null, cat: PRCategory) => {
    if (!act) return;
    if (!map[act.id]) map[act.id] = [];
    if (!map[act.id].includes(cat)) {
      map[act.id].push(cat);
    }
  };

  // Running
  register(prs.running.longestDistance, "longestDistance");
  register(prs.running.bestPace, "bestPace");
  register(prs.running.longestDuration, "longestDuration");
  register(prs.running.highestElevation, "highestElevation");

  // Cycling
  register(prs.cycling.longestDistance, "longestDistance");
  register(prs.cycling.highestAvgSpeed, "highestAvgSpeed");
  register(prs.cycling.maxSpeed, "maxSpeed");
  register(prs.cycling.highestElevation, "highestElevation");
  register(prs.cycling.bestPower, "bestPower");
  register(prs.cycling.longestDuration, "longestDuration");

  return map;
}
