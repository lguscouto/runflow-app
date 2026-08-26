import type {
  ActivityDetail,
  PowerZone,
  PowerZoneAnalysis,
  PowerZoneDurationSummary,
  PowerZoneId,
  TrackPoint,
  UserProfile,
} from "./types";
import { colorTokens } from "./color-tokens";

/**
 * FTP padrão sugerido caso o usuário ainda não tenha configurado no perfil.
 */
export const DEFAULT_FTP_WATTS = 200;

/**
 * Retorna o FTP efetivo do usuário baseado no perfil.
 */
export function getEffectiveFtp(profile?: UserProfile | null): number {
  if (
    profile?.cyclingFtpWatts != null &&
    profile.cyclingFtpWatts >= 40 &&
    profile.cyclingFtpWatts <= 700
  ) {
    return Math.round(profile.cyclingFtpWatts);
  }
  return DEFAULT_FTP_WATTS;
}

/**
 * Definições e Cores das 7 Zonas de Potência clássicas de Andrew Coggan (2000).
 */
export const COGGAN_POWER_ZONE_DEFINITIONS: Array<{
  zone: PowerZoneId;
  nameKey: string;
  descKey: string;
  minPct: number;
  maxPct: number;
  color: string;
  bgRgba: string;
}> = [
  {
    zone: 1,
    nameKey: "power_zones.z1_name",
    descKey: "power_zones.z1_desc",
    minPct: 0,
    maxPct: 0.55,
    color: colorTokens.zones.power1, // Slate / Cinza
    bgRgba: colorTokens.zoneBackgrounds.power1,
  },
  {
    zone: 2,
    nameKey: "power_zones.z2_name",
    descKey: "power_zones.z2_desc",
    minPct: 0.56,
    maxPct: 0.75,
    color: colorTokens.zones.power2, // Sky / Azul Claro
    bgRgba: colorTokens.zoneBackgrounds.power2,
  },
  {
    zone: 3,
    nameKey: "power_zones.z3_name",
    descKey: "power_zones.z3_desc",
    minPct: 0.76,
    maxPct: 0.90,
    color: colorTokens.zones.power3, // Emerald / Verde
    bgRgba: colorTokens.zoneBackgrounds.power3,
  },
  {
    zone: 4,
    nameKey: "power_zones.z4_name",
    descKey: "power_zones.z4_desc",
    minPct: 0.91,
    maxPct: 1.05,
    color: colorTokens.zones.power4, // Amber / Amarelo
    bgRgba: colorTokens.zoneBackgrounds.power4,
  },
  {
    zone: 5,
    nameKey: "power_zones.z5_name",
    descKey: "power_zones.z5_desc",
    minPct: 1.06,
    maxPct: 1.20,
    color: colorTokens.zones.power5, // Orange / Laranja
    bgRgba: colorTokens.zoneBackgrounds.power5,
  },
  {
    zone: 6,
    nameKey: "power_zones.z6_name",
    descKey: "power_zones.z6_desc",
    minPct: 1.21,
    maxPct: 1.50,
    color: colorTokens.zones.power6, // Rose / Vermelho
    bgRgba: colorTokens.zoneBackgrounds.power6,
  },
  {
    zone: 7,
    nameKey: "power_zones.z7_name",
    descKey: "power_zones.z7_desc",
    minPct: 1.51,
    maxPct: 9.99,
    color: colorTokens.zones.power7, // Purple / Roxo
    bgRgba: colorTokens.zoneBackgrounds.power7,
  },
];

/**
 * Calcula as faixas de Watts de cada uma das 7 Zonas de Coggan para um determinado FTP.
 */
export function calculatePowerZones(ftpWatts: number): PowerZone[] {
  const ftp = Math.max(40, ftpWatts);

  return COGGAN_POWER_ZONE_DEFINITIONS.map((def) => {
    let minWatts: number;
    let maxWatts: number;

    if (def.zone === 1) {
      minWatts = 0;
      maxWatts = Math.round(ftp * def.maxPct);
    } else if (def.zone === 7) {
      minWatts = Math.round(ftp * def.minPct);
      maxWatts = 9999;
    } else {
      minWatts = Math.round(ftp * def.minPct);
      maxWatts = Math.round(ftp * def.maxPct);
    }

    return {
      zone: def.zone,
      nameKey: def.nameKey,
      descKey: def.descKey,
      minPct: def.minPct,
      maxPct: def.maxPct,
      minWatts,
      maxWatts,
      color: def.color,
      bgRgba: def.bgRgba,
    };
  });
}

/**
 * Encontra a Zona de Potência correspondente a uma potência instantânea em Watts.
 */
export function getCurrentPowerZone(
  watts: number | null | undefined,
  zones: PowerZone[]
): PowerZone | null {
  if (watts == null || watts <= 0 || !Number.isFinite(watts) || zones.length === 0) {
    return null;
  }

  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    if (i === zones.length - 1) {
      if (watts >= z.minWatts) return z;
    } else {
      if (watts >= z.minWatts && watts <= z.maxWatts) return z;
    }
  }

  return zones[0];
}

/**
 * Calcula a relação Potência por Peso (Watts / kg).
 */
export function calculateWattsPerKg(
  watts?: number | null,
  weightKg?: number | null
): number | null {
  if (watts == null || watts <= 0 || weightKg == null || weightKg <= 0) {
    return null;
  }
  const wkg = watts / weightKg;
  return Math.round(wkg * 100) / 100;
}

/**
 * Calcula o FTP estimado com base no teste clássico de 20 minutos de Hunter Allen & Andrew Coggan:
 * FTP = Potência Média de 20 min * 0.95
 */
export function calculateFtpFrom20MinTest(avg20MinWatts: number): number {
  if (!avg20MinWatts || avg20MinWatts <= 0) return DEFAULT_FTP_WATTS;
  return Math.round(avg20MinWatts * 0.95);
}

/**
 * Estima o FTP com base no peso corporal e nível aproximado do ciclista (W/kg).
 */
export function estimateFtpFromWeight(
  weightKg?: number,
  fitnessLevel: "recreational" | "moderate" | "trained" | "advanced" = "moderate"
): number {
  const weight = weightKg && weightKg >= 35 && weightKg <= 200 ? weightKg : 75;
  const multipliers: Record<string, number> = {
    recreational: 2.2, // ~Iniciante / Passeio
    moderate: 2.8, // ~Intermediário / Cicloturismo
    trained: 3.4, // ~Treinado / Amador Competitivo
    advanced: 4.1, // ~Avançado / Elite Amador
  };
  const multiplier = multipliers[fitnessLevel] || 2.8;
  return Math.round(weight * multiplier);
}

/**
 * Calcula a Potência Normalizada (Normalized Power - NP™ de Coggan)
 * Algoritmo:
 * 1. Calcula a média móvel de 30 segundos dos valores de potência.
 * 2. Eleva cada valor de 30s à 4ª potência.
 * 3. Calcula a média desses valores.
 * 4. Tira a raiz 4ª do resultado.
 */
export function calculateNormalizedPower(
  points: TrackPoint[],
  durationSec?: number
): number | null {
  const pointsWithWatts = (points || []).filter(
    (p) => p.watts != null && p.watts >= 0
  );

  if (pointsWithWatts.length < 30) {
    return null;
  }

  // Interpolação/Série temporal em segundos
  const wattsSeries: number[] = [];
  for (let i = 0; i < pointsWithWatts.length; i++) {
    const pt = pointsWithWatts[i];
    const w = pt.watts || 0;
    let count = 1;

    if (i < pointsWithWatts.length - 1 && pt.timestamp && pointsWithWatts[i + 1].timestamp) {
      const t1 = new Date(pt.timestamp).getTime();
      const t2 = new Date(pointsWithWatts[i + 1].timestamp!).getTime();
      const dt = Math.min(10, Math.max(1, Math.round((t2 - t1) / 1000)));
      count = dt;
    }

    for (let c = 0; c < count; c++) {
      wattsSeries.push(w);
    }
  }

  if (wattsSeries.length < 30) return null;

  // Média móvel de 30 segundos
  const rolling30s: number[] = [];
  let currentSum = 0;
  for (let i = 0; i < wattsSeries.length; i++) {
    currentSum += wattsSeries[i];
    if (i >= 30) {
      currentSum -= wattsSeries[i - 30];
      const avg = currentSum / 30;
      rolling30s.push(Math.pow(avg, 4));
    }
  }

  if (rolling30s.length === 0) return null;

  const sum4th = rolling30s.reduce((a, b) => a + b, 0);
  const avg4th = sum4th / rolling30s.length;
  const np = Math.round(Math.pow(avg4th, 0.25));

  return np > 0 ? np : null;
}

/**
 * Análise completa de Zonas de Potência, NP, IF, TSS e VI para atividades de ciclismo.
 */
export function analyzeActivityPowerZones(
  activity: ActivityDetail,
  profile?: UserProfile
): PowerZoneAnalysis {
  const ftp = getEffectiveFtp(profile);
  const zones = calculatePowerZones(ftp);

  const zoneDurations: Record<PowerZoneId, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
  };

  const pointsWithWatts = (activity.points || []).filter(
    (p) => p.watts != null && p.watts >= 0
  );

  let avgWatts = activity.avgWatts ?? 0;
  let maxWatts = activity.maxWatts ?? 0;

  const hasPower =
    pointsWithWatts.length > 0 || (activity.avgWatts != null && activity.avgWatts > 0);

  if (pointsWithWatts.length >= 2) {
    let totalWattsSum = 0;
    let maxFound = 0;

    for (let i = 0; i < pointsWithWatts.length; i++) {
      const pt = pointsWithWatts[i];
      const w = pt.watts!;
      totalWattsSum += w;
      if (w > maxFound) maxFound = w;

      let intervalSec = 1;
      if (i < pointsWithWatts.length - 1) {
        const nextPt = pointsWithWatts[i + 1];
        if (pt.timestamp && nextPt.timestamp) {
          const t1 = new Date(pt.timestamp).getTime();
          const t2 = new Date(nextPt.timestamp).getTime();
          const delta = (t2 - t1) / 1000;
          if (delta > 0 && delta <= 30) {
            intervalSec = delta;
          }
        }
      }

      const z = getCurrentPowerZone(w, zones);
      if (z) {
        zoneDurations[z.zone] += intervalSec;
      }
    }

    if (!activity.avgWatts && pointsWithWatts.length > 0) {
      avgWatts = Math.round(totalWattsSum / pointsWithWatts.length);
    }
    if (!activity.maxWatts && maxFound > 0) {
      maxWatts = maxFound;
    }
  } else if (activity.avgWatts && activity.avgWatts > 0) {
    const z = getCurrentPowerZone(activity.avgWatts, zones);
    if (z) {
      zoneDurations[z.zone] = activity.durationSec;
    }
  }

  const totalZoneTimeSec = Object.values(zoneDurations).reduce((a, b) => a + b, 0);
  const totalTimeSec =
    totalZoneTimeSec > 0 ? totalZoneTimeSec : activity.durationSec || 1;

  const zoneSummaries: PowerZoneDurationSummary[] = zones.map((zone) => {
    const duration = zoneDurations[zone.zone] || 0;
    const percent = totalTimeSec > 0 ? Math.round((duration / totalTimeSec) * 100) : 0;
    return {
      zone,
      durationSec: Math.round(duration),
      percent,
    };
  });

  let dominantZone: PowerZoneId | null = null;
  let maxDuration = 0;
  for (const zs of zoneSummaries) {
    if (zs.durationSec > maxDuration) {
      maxDuration = zs.durationSec;
      dominantZone = zs.zone.zone;
    }
  }

  // Normalized Power
  const normalizedPowerWatts =
    activity.normalizedPowerWatts ??
    calculateNormalizedPower(activity.points, totalTimeSec) ??
    (avgWatts > 0 ? Math.round(avgWatts * 1.05) : undefined);

  // Intensity Factor (IF = NP / FTP)
  let intensityFactor: number | undefined;
  if (normalizedPowerWatts && ftp > 0) {
    intensityFactor = Math.round((normalizedPowerWatts / ftp) * 100) / 100;
  }

  // Training Stress Score: TSS = (t_sec * NP * IF) / (FTP * 3600) * 100
  let trainingStressScore: number | undefined;
  if (normalizedPowerWatts && intensityFactor && ftp > 0 && totalTimeSec > 0) {
    const tHours = totalTimeSec / 3600;
    const tss = (tHours * normalizedPowerWatts * intensityFactor * 100) / ftp;
    trainingStressScore = Math.round(tss);
  }

  // Variability Index (VI = NP / avgWatts)
  let variabilityIndex: number | undefined;
  if (normalizedPowerWatts && avgWatts > 0) {
    variabilityIndex = Math.round((normalizedPowerWatts / avgWatts) * 100) / 100;
  }

  // Watts/kg
  const wattsPerKg = calculateWattsPerKg(avgWatts, profile?.weightKg);

  return {
    ftpWatts: ftp,
    avgWatts,
    maxWatts,
    normalizedPowerWatts,
    intensityFactor,
    trainingStressScore,
    variabilityIndex,
    wattsPerKg: wattsPerKg ?? undefined,
    hasPower,
    totalTimeSec,
    zones: zoneSummaries,
    dominantZone,
  };
}
