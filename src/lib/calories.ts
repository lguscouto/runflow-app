import type { Sport, UserProfile } from "./types";

/** Massa usada no cálculo MET (prioriza massa magra se houver % gordura). */
export function getEffectiveMassKg(profile: UserProfile): number | null {
  const weight = profile.weightKg;
  if (weight == null || weight <= 0) return null;

  const fat = profile.bodyFatPercent;
  if (
    fat != null &&
    fat >= 0 &&
    fat < 100
  ) {
    return weight * (1 - fat / 100);
  }
  return weight;
}

/** MET aproximado conforme Compendium of Physical Activities / ritmo. */
export function metForSport(
  sport: Sport,
  paceSecPerKm?: number | null
): number {
  if (sport === "walking") {
    if (!paceSecPerKm || paceSecPerKm <= 0) return 4.3;
    const speedKmh = 3600 / paceSecPerKm;
    if (speedKmh < 4) return 3.0;
    if (speedKmh < 5.5) return 4.3;
    return 5.0;
  }

  if (sport === "cycling") {
    if (!paceSecPerKm || paceSecPerKm <= 0) return 8.0;
    const speedKmh = 3600 / paceSecPerKm;
    if (speedKmh < 16) return 6.8;
    if (speedKmh < 20) return 8.0;
    if (speedKmh < 25) return 10.0;
    return 12.0;
  }

  if (sport === "running") {
    return metForRunningPace(paceSecPerKm);
  }

  return 6.0;
}

function metForRunningPace(paceSecPerKm?: number | null): number {
  if (!paceSecPerKm || paceSecPerKm <= 0) return 9.8;
  const speedKmh = 3600 / paceSecPerKm;
  if (speedKmh < 6) return 6.0;
  if (speedKmh < 8) return 8.3;
  if (speedKmh < 9.7) return 9.8;
  if (speedKmh < 11.3) return 11.0;
  if (speedKmh < 12.9) return 11.5;
  return 12.8;
}

/**
 * Estima calorias gastas: kcal = MET × massa(kg) × tempo(h).
 * Inclui pequeno ajuste por elevação acumulada.
 */
export function estimateActivityCalories(
  profile: UserProfile | null,
  params: {
    sport: Sport;
    durationSec: number;
    distanceM: number;
    avgPaceSecKm?: number | null;
    elevationGainM?: number | null;
  }
): number | null {
  if (!profile) return null;

  const mass = getEffectiveMassKg(profile);
  if (!mass || params.durationSec <= 0) return null;

  let pace = params.avgPaceSecKm;
  if ((pace == null || pace <= 0) && params.distanceM > 0) {
    pace = (params.durationSec / params.distanceM) * 1000;
  }

  const met = metForSport(params.sport, pace);
  const hours = params.durationSec / 3600;
  let kcal = met * mass * hours;

  const elev = params.elevationGainM ?? 0;
  if (elev > 0) {
    kcal += 0.08 * mass * elev;
  }

  return Math.max(1, Math.round(kcal));
}

export function profileHasCalorieInputs(profile: UserProfile | null): boolean {
  return profile?.weightKg != null && profile.weightKg > 0;
}
