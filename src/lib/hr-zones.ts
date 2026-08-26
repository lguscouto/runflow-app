import type {
  ActivityDetail,
  HeartRateZone,
  HeartRateZoneAnalysis,
  HRZoneId,
  TrainingEffectCategory,
  UserProfile,
  ZoneDurationSummary,
} from "./types";
import { colorTokens } from "./color-tokens";

/**
 * Fórmula de Tanaka et al. (2001) para cálculo de FC Máxima:
 * FCmax = 208 - (0.7 * idade)
 */
export function calculateTanakaMaxHr(age?: number): number {
  if (age != null && age >= 10 && age <= 120) {
    return Math.round(208 - 0.7 * age);
  }
  return 185; // Valor padrão para corredor adulto médio
}

/**
 * Retorna a FC Máxima e FC de Repouso efetivas baseadas no perfil.
 */
export function getEffectiveMaxAndRestingHr(profile?: UserProfile): {
  maxHr: number;
  restingHr?: number;
} {
  const maxHr =
    profile?.maxHr != null && profile.maxHr >= 100 && profile.maxHr <= 240
      ? profile.maxHr
      : calculateTanakaMaxHr(profile?.age);

  const restingHr =
    profile?.restingHr != null &&
    profile.restingHr >= 30 &&
    profile.restingHr <= 120
      ? profile.restingHr
      : undefined;

  return { maxHr, restingHr };
}

/**
 * Cores e Metadados das 5 Zonas de Frequência Cardíaca
 */
const ZONE_DEFINITIONS: Array<{
  zone: HRZoneId;
  nameKey: string;
  descKey: string;
  minPct: number;
  maxPct: number;
  color: string;
  bgRgba: string;
}> = [
  {
    zone: 1,
    nameKey: "hr_zones.z1_name",
    descKey: "hr_zones.z1_desc",
    minPct: 0.5,
    maxPct: 0.6,
    color: colorTokens.zones.hr1, // Slate / Cinza Claro
    bgRgba: colorTokens.zoneBackgrounds.hr1,
  },
  {
    zone: 2,
    nameKey: "hr_zones.z2_name",
    descKey: "hr_zones.z2_desc",
    minPct: 0.6,
    maxPct: 0.7,
    color: colorTokens.zones.hr2, // Sky Blue / Ciano
    bgRgba: colorTokens.zoneBackgrounds.hr2,
  },
  {
    zone: 3,
    nameKey: "hr_zones.z3_name",
    descKey: "hr_zones.z3_desc",
    minPct: 0.7,
    maxPct: 0.8,
    color: colorTokens.zones.hr3, // Emerald / Verde
    bgRgba: colorTokens.zoneBackgrounds.hr3,
  },
  {
    zone: 4,
    nameKey: "hr_zones.z4_name",
    descKey: "hr_zones.z4_desc",
    minPct: 0.8,
    maxPct: 0.9,
    color: colorTokens.zones.hr4, // Amber / Âmbar / Laranja
    bgRgba: colorTokens.zoneBackgrounds.hr4,
  },
  {
    zone: 5,
    nameKey: "hr_zones.z5_name",
    descKey: "hr_zones.z5_desc",
    minPct: 0.9,
    maxPct: 1.0,
    color: colorTokens.zones.hr5, // Rose / Vermelho Intenso
    bgRgba: colorTokens.zoneBackgrounds.hr5,
  },
];

/**
 * Calcula os limites de bpm de cada uma das 5 Zonas (usando Karvonen se houver restingHr ou %FCmax direta).
 */
export function calculateHrZones(profile?: UserProfile): HeartRateZone[] {
  const { maxHr, restingHr } = getEffectiveMaxAndRestingHr(profile);

  return ZONE_DEFINITIONS.map((def) => {
    let minBpm: number;
    let maxBpm: number;

    if (restingHr != null && restingHr < maxHr) {
      // Fórmula de Reserva Cardíaca de Karvonen (HRR):
      // HR = HR_rest + % * (HR_max - HR_rest)
      const hrr = maxHr - restingHr;
      minBpm = Math.round(restingHr + def.minPct * hrr);
      maxBpm = Math.round(restingHr + def.maxPct * hrr);
    } else {
      // Porcentagem Direta da FC Máxima
      minBpm = Math.round(maxHr * def.minPct);
      maxBpm = Math.round(maxHr * def.maxPct);
    }

    return {
      zone: def.zone,
      nameKey: def.nameKey,
      descKey: def.descKey,
      minBpm,
      maxBpm,
      minPct: def.minPct,
      maxPct: def.maxPct,
      color: def.color,
      bgRgba: def.bgRgba,
    };
  });
}

/**
 * Encontra a zona correspondente a um determinado batimento cardíaco instantâneo.
 */
export function getCurrentHrZone(
  bpm: number | null | undefined,
  zones: HeartRateZone[]
): HeartRateZone | null {
  if (bpm == null || bpm <= 0 || !Number.isFinite(bpm) || zones.length === 0) {
    return null;
  }

  if (bpm < zones[0].minBpm) {
    return zones[0];
  }

  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    if (i === zones.length - 1) {
      if (bpm >= z.minBpm) return z;
    } else {
      if (bpm >= z.minBpm && bpm < z.maxBpm) return z;
    }
  }

  return zones[zones.length - 1];
}

/**
 * Análise aprofundada de Zonas de FC e Carga Cardiovascular (TRIMP) para uma atividade.
 */
export function analyzeActivityHeartRate(
  activity: ActivityDetail,
  profile?: UserProfile
): HeartRateZoneAnalysis {
  const { maxHr, restingHr } = getEffectiveMaxAndRestingHr(profile);
  const zones = calculateHrZones(profile);

  const zoneDurations: Record<HRZoneId, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  const pointsWithHr = (activity.points || []).filter(
    (p) => p.hr != null && p.hr > 0
  );

  let avgHr = activity.avgHr ?? 0;
  let peakHr = activity.maxHr ?? 0;

  const hasHeartRate = pointsWithHr.length > 0 || (activity.avgHr != null && activity.avgHr > 0);

  if (pointsWithHr.length >= 2) {
    let totalHrSum = 0;
    let maxFound = 0;

    for (let i = 0; i < pointsWithHr.length; i++) {
      const pt = pointsWithHr[i];
      const hr = pt.hr!;
      totalHrSum += hr;
      if (hr > maxFound) maxFound = hr;

      let intervalSec = 1;
      if (i < pointsWithHr.length - 1) {
        const nextPt = pointsWithHr[i + 1];
        if (pt.timestamp && nextPt.timestamp) {
          const t1 = new Date(pt.timestamp).getTime();
          const t2 = new Date(nextPt.timestamp).getTime();
          const delta = (t2 - t1) / 1000;
          if (delta > 0 && delta <= 30) {
            intervalSec = delta;
          }
        }
      }

      const z = getCurrentHrZone(hr, zones);
      if (z) {
        zoneDurations[z.zone] += intervalSec;
      }
    }

    if (!activity.avgHr && pointsWithHr.length > 0) {
      avgHr = Math.round(totalHrSum / pointsWithHr.length);
    }
    if (!activity.maxHr && maxFound > 0) {
      peakHr = maxFound;
    }
  } else if (activity.avgHr && activity.avgHr > 0) {
    const z = getCurrentHrZone(activity.avgHr, zones);
    if (z) {
      zoneDurations[z.zone] = activity.durationSec;
    }
  }

  const totalZoneTimeSec = Object.values(zoneDurations).reduce((a, b) => a + b, 0);
  const totalTimeSec = totalZoneTimeSec > 0 ? totalZoneTimeSec : activity.durationSec;

  const zoneSummaries: ZoneDurationSummary[] = zones.map((zone) => {
    const duration = zoneDurations[zone.zone] || 0;
    const percent = totalTimeSec > 0 ? Math.round((duration / totalTimeSec) * 100) : 0;
    return {
      zone,
      durationSec: Math.round(duration),
      percent,
    };
  });

  let dominantZone: HRZoneId | null = null;
  let maxDuration = 0;
  for (const zs of zoneSummaries) {
    if (zs.durationSec > maxDuration) {
      maxDuration = zs.durationSec;
      dominantZone = zs.zone.zone;
    }
  }

  // Edwards TRIMP
  let edwardsTrimp = 0;
  for (const zs of zoneSummaries) {
    const mins = zs.durationSec / 60;
    edwardsTrimp += mins * zs.zone.zone;
  }

  // Banister TRIMP
  let banisterTrimp = 0;
  if (avgHr > 0 && maxHr > 0) {
    const rHr = restingHr || 60;
    const durationMin = totalTimeSec / 60;
    const deltaHr = Math.max(0, Math.min(1, (avgHr - rHr) / (maxHr - rHr)));
    banisterTrimp = durationMin * deltaHr * 0.64 * Math.exp(1.92 * deltaHr);
  }

  const trimpScore = Math.round(banisterTrimp > 0 ? (banisterTrimp + edwardsTrimp) / 2 : edwardsTrimp);

  let trainingLoadLabel: "light" | "moderate" | "optimal" | "extreme";
  if (trimpScore < 45) {
    trainingLoadLabel = "light";
  } else if (trimpScore < 95) {
    trainingLoadLabel = "moderate";
  } else if (trimpScore < 165) {
    trainingLoadLabel = "optimal";
  } else {
    trainingLoadLabel = "extreme";
  }

  let trainingEffect: TrainingEffectCategory = "aerobic_base";

  const z4z5Percent =
    (zoneSummaries[3].percent || 0) + (zoneSummaries[4].percent || 0);
  const z3Percent = zoneSummaries[2].percent || 0;
  const z2Percent = zoneSummaries[1].percent || 0;
  const z1Percent = zoneSummaries[0].percent || 0;

  if (z4z5Percent >= 25 || zoneSummaries[4].percent >= 15) {
    trainingEffect = "anaerobic_vo2";
  } else if (z4z5Percent >= 15 || dominantZone === 4) {
    trainingEffect = "threshold";
  } else if (z3Percent >= 35 || dominantZone === 3) {
    trainingEffect = "tempo";
  } else if (z1Percent >= 50 && z2Percent < 30) {
    trainingEffect = "recovery";
  } else {
    trainingEffect = "aerobic_base";
  }

  return {
    maxHr,
    restingHr,
    avgHr,
    peakHr,
    hasHeartRate,
    totalTimeSec,
    zones: zoneSummaries,
    dominantZone,
    trimpScore,
    trainingEffect,
    trainingLoadLabel,
  };
}
