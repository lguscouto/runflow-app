import type { BikeType, TrackPoint } from "./types";
import { haversineM } from "./geo";

/**
 * Constantes físicas padrão para ciclismo (Martin et al., 1998 / GoldenCheetah)
 */
export const AIR_DENSITY_KG_M3 = 1.225; // Densidade do ar ao nível do mar (15°C, 1013.25 hPa)
export const GRAVITY_M_S2 = 9.80665; // Aceleração da gravidade terrestre
export const DRIVETRAIN_EFFICIENCY = 0.975; // Eficiência mecânica da transmissão (~97.5% com corrente lubrificada)

/**
 * Coeficiente de arrasto aerodinâmico × Área frontal (CdA em m²) por tipo de bike
 */
export const BIKE_CDA_MAP: Record<BikeType, number> = {
  tt: 0.25, // Triathlon / Contra-relógio (posição aero extrema)
  road: 0.32, // Speed / Asfalto (posição padrão nas maçanetas)
  gravel: 0.38, // Gravel (guidão drop mais largo / postura ereta)
  urban: 0.42, // Urbana / Conforto (postura ereta)
  mtb: 0.44, // Mountain Bike (guidão reto amplo / pneus largos)
  ebike: 0.42, // E-Bike
  other: 0.38,
};

/**
 * Coeficiente de resistência ao rolamento dos pneus (Crr) por tipo de bike
 */
export const BIKE_CRR_MAP: Record<BikeType, number> = {
  tt: 0.0035, // Pneus slick tubeless ultra-finos (25c @ 85 psi)
  road: 0.0040, // Pneus de estrada modernos (700x28c @ 70 psi)
  gravel: 0.0055, // Pneus gravel (700x40c @ 40 psi)
  urban: 0.0060, // Pneus urbanos com proteção antifuro (700x35c)
  mtb: 0.0075, // Pneus de MTB com cravos (29x2.25 @ 25 psi)
  ebike: 0.0065,
  other: 0.0055,
};

export interface CyclingPhysicsParams {
  speedMs: number; // Velocidade em m/s (km/h ÷ 3.6)
  gradePercent: number; // Inclinação do terreno (% grade, ex: 5.0 para 5%)
  riderMassKg?: number; // Peso do ciclista (kg, padrão: 75 kg)
  bikeMassKg?: number; // Peso da bike (kg, padrão: 9.0 kg)
  bikeType?: BikeType; // Tipo da bicicleta (padrão: "road")
  windSpeedMs?: number; // Velocidade do vento relativo (m/s, padrão: 0)
}

export interface CyclingPowerBreakdown {
  totalWatts: number;
  aeroWatts: number;
  climbWatts: number;
  rollingWatts: number;
}

/**
 * Calcula a potência mecânica estimada nas pernas (Watts) usando modelo físico científico:
 * P_total = (P_aero + P_climb + P_rolling) / η
 */
export function calculateCyclingPower(params: CyclingPhysicsParams): CyclingPowerBreakdown {
  const v = Math.max(0, params.speedMs);
  if (v <= 0.2) {
    return { totalWatts: 0, aeroWatts: 0, climbWatts: 0, rollingWatts: 0 };
  }

  const riderMass = params.riderMassKg && params.riderMassKg > 30 ? params.riderMassKg : 75;
  const bikeMass = params.bikeMassKg && params.bikeMassKg > 0 ? params.bikeMassKg : 9.0;
  const totalMassKg = riderMass + bikeMass;

  const bikeType: BikeType = params.bikeType || "road";
  const cdA = BIKE_CDA_MAP[bikeType] ?? 0.32;
  const crr = BIKE_CRR_MAP[bikeType] ?? 0.0040;

  const gradeRatio = (params.gradePercent || 0) / 100;
  const thetaRad = Math.atan(gradeRatio);

  // 1. Resistência Aerodinâmica (Arrasto do ar)
  const relativeAirSpeed = v + (params.windSpeedMs || 0);
  const fAero = 0.5 * AIR_DENSITY_KG_M3 * cdA * Math.pow(relativeAirSpeed, 2);
  const aeroWatts = fAero * v;

  // 2. Gravidade / Subida
  const fClimb = totalMassKg * GRAVITY_M_S2 * Math.sin(thetaRad);
  const climbWatts = fClimb * v;

  // 3. Resistência ao Rolamento dos Pneus
  const fRolling = crr * totalMassKg * GRAVITY_M_S2 * Math.cos(thetaRad);
  const rollingWatts = fRolling * v;

  // 4. Potência Total na Roda e nas Pernas (ajustada pela eficiência da corrente)
  const powerAtWheel = aeroWatts + climbWatts + rollingWatts;
  
  // Em descidas onde a gravidade acelera mais que as pernas, a potência mecânica é 0 (roda livre / freewheel)
  const totalWatts = Math.max(0, Math.round(powerAtWheel / DRIVETRAIN_EFFICIENCY));

  return {
    totalWatts,
    aeroWatts: Math.round(Math.max(0, aeroWatts)),
    climbWatts: Math.round(climbWatts),
    rollingWatts: Math.round(Math.max(0, rollingWatts)),
  };
}

/**
 * Calcula a inclinação percentual (% Grade) entre dois pontos ou em uma janela de pontos.
 */
export function calculateSegmentGradePercent(
  distMeters: number,
  elevationDeltaM: number
): number {
  if (distMeters < 5) return 0;
  const rawGrade = (elevationDeltaM / distMeters) * 100;
  // Limitar a valores realistas de inclinação viária (-30% a +35%)
  return Math.max(-30, Math.min(35, rawGrade));
}

/**
 * Calcula a inclinação instantânea suavizada (% grade) com base nos últimos N metros de GPS.
 */
export function computeInstantGradePercent(
  points: TrackPoint[],
  windowDistanceM = 30
): number {
  if (points.length < 2) return 0;

  const lastPoint = points[points.length - 1];
  if (lastPoint.elevation == null) return 0;

  let cumDist = 0;
  let oldestElevation = lastPoint.elevation;

  for (let i = points.length - 1; i >= 1; i--) {
    const curr = points[i];
    const prev = points[i - 1];
    const segDist = haversineM(prev.lat, prev.lng, curr.lat, curr.lng);
    cumDist += segDist;

    if (prev.elevation != null) {
      oldestElevation = prev.elevation;
    }

    if (cumDist >= windowDistanceM) {
      break;
    }
  }

  if (cumDist < 10) return 0;
  const deltaElev = lastPoint.elevation - oldestElevation;
  return calculateSegmentGradePercent(cumDist, deltaElev);
}

/**
 * Calcula a VAM (Velocidade Ascensional Média em m/h)
 */
export function calculateVamMh(
  elevationGainM: number,
  durationSec: number
): number {
  if (durationSec <= 30 || elevationGainM <= 5) return 0;
  return Math.round((elevationGainM / durationSec) * 3600);
}

/**
 * Calcula a Potência Normalizada (NP - Normalized Power pelo algoritmo de Andrew Coggan):
 * 1. Média móvel de 30s da potência
 * 2. Elevação à 4ª potência
 * 3. Média dos valores
 * 4. Raiz quarta do resultado
 */
export function calculateNormalizedPower(wattsSeries: number[]): number | null {
  const validWatts = wattsSeries.filter((w) => Number.isFinite(w) && w >= 0);
  if (validWatts.length < 30) {
    if (validWatts.length === 0) return null;
    const avg = validWatts.reduce((a, b) => a + b, 0) / validWatts.length;
    return Math.round(avg);
  }

  // Janela móvel de 30 amostras (~30 segundos a 1Hz)
  const windowSize = 30;
  const rolling30s: number[] = [];

  let currentSum = 0;
  for (let i = 0; i < validWatts.length; i++) {
    currentSum += validWatts[i];
    if (i >= windowSize) {
      currentSum -= validWatts[i - windowSize];
      rolling30s.push(currentSum / windowSize);
    } else if (i === windowSize - 1) {
      rolling30s.push(currentSum / windowSize);
    }
  }

  if (rolling30s.length === 0) return null;

  // Eleva à quarta potência e calcula média
  const sum4th = rolling30s.reduce((acc, w) => acc + Math.pow(w, 4), 0);
  const avg4th = sum4th / rolling30s.length;

  const np = Math.pow(avg4th, 0.25);
  return Number.isFinite(np) ? Math.round(np) : null;
}

export interface CyclingSummaryStats {
  avgSpeedKmh: number | null;
  maxSpeedKmh: number | null;
  avgWatts: number | null;
  maxWatts: number | null;
  normalizedPowerWatts: number | null;
  vamMh: number | null;
  maxGradePercent: number | null;
  powerSeriesWatts: number[];
}

/**
 * Processa a trilha inteira de TrackPoints para computar todas as métricas agregadas de ciclismo.
 */
export function computeCyclingActivityStats(
  points: TrackPoint[],
  durationSec: number,
  riderMassKg?: number,
  bikeMassKg?: number,
  bikeType?: BikeType
): CyclingSummaryStats {
  if (points.length < 2) {
    return {
      avgSpeedKmh: null,
      maxSpeedKmh: null,
      avgWatts: null,
      maxWatts: null,
      normalizedPowerWatts: null,
      vamMh: null,
      maxGradePercent: null,
      powerSeriesWatts: [],
    };
  }

  let totalDistanceM = 0;
  let maxSpeedMs = 0;
  let maxGrade = 0;
  let elevationGainM = 0;
  const powerSeries: number[] = [];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    const segDist = haversineM(prev.lat, prev.lng, curr.lat, curr.lng);
    totalDistanceM += segDist;

    let dtSec = 1;
    if (prev.timestamp && curr.timestamp) {
      dtSec = Math.max(0.5, (curr.timestamp.getTime() - prev.timestamp.getTime()) / 1000);
    }

    const segSpeedMs = dtSec > 0 ? segDist / dtSec : 0;
    if (segSpeedMs > maxSpeedMs && segSpeedMs < 35) { // filtro de até 126 km/h
      maxSpeedMs = segSpeedMs;
    }

    let segElevDelta = 0;
    if (prev.elevation != null && curr.elevation != null) {
      segElevDelta = curr.elevation - prev.elevation;
      if (segElevDelta > 0) {
        elevationGainM += segElevDelta;
      }
    }

    const grade = calculateSegmentGradePercent(segDist, segElevDelta);
    if (grade > maxGrade) {
      maxGrade = grade;
    }

    // Se o ponto já tiver watts (ex: de arquivo FIT com sensor CPS), usa nativo; senão estima por física
    const pointWatts =
      curr.watts != null
        ? curr.watts
        : calculateCyclingPower({
            speedMs: segSpeedMs,
            gradePercent: grade,
            riderMassKg,
            bikeMassKg,
            bikeType,
          }).totalWatts;

    powerSeries.push(pointWatts);
  }

  const avgSpeedKmh =
    durationSec > 0 && totalDistanceM > 0
      ? (totalDistanceM / durationSec) * 3.6
      : null;

  const maxSpeedKmh = maxSpeedMs > 0 ? maxSpeedMs * 3.6 : null;

  const avgWatts =
    powerSeries.length > 0
      ? Math.round(powerSeries.reduce((a, b) => a + b, 0) / powerSeries.length)
      : null;

  const maxWatts = powerSeries.length > 0 ? Math.max(...powerSeries) : null;
  const np = calculateNormalizedPower(powerSeries);
  const vam = calculateVamMh(elevationGainM, durationSec);

  return {
    avgSpeedKmh: avgSpeedKmh != null ? Number(avgSpeedKmh.toFixed(1)) : null,
    maxSpeedKmh: maxSpeedKmh != null ? Number(maxSpeedKmh.toFixed(1)) : null,
    avgWatts,
    maxWatts,
    normalizedPowerWatts: np,
    vamMh: vam > 0 ? vam : null,
    maxGradePercent: maxGrade > 0 ? Number(maxGrade.toFixed(1)) : null,
    powerSeriesWatts: powerSeries,
  };
}
