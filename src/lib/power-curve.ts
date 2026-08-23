import type { ActivityDetail, TrackPoint } from "./types";

export interface PowerCurvePoint {
  durationSec: number;
  label: string;
  watts: number;
  wattsPerKg?: number;
  percentFtp?: number;
  startIndex?: number;
  endIndex?: number;
}

export interface PeakPowerEffort {
  key: string;
  durationSec: number;
  label: string;
  nameKey: string;
  watts: number;
  wattsPerKg?: number;
  percentFtp?: number;
  startTimeSec?: number;
  endTimeSec?: number;
}

export interface PowerCurveAnalysis {
  hasPower: boolean;
  maxWatts: number;
  avgWatts: number;
  points: PowerCurvePoint[];
  peakEfforts: PeakPowerEffort[];
}

export const STANDARD_INTERVALS: Array<{ sec: number; label: string; nameKey: string }> = [
  { sec: 5, label: "5s", nameKey: "power_curve.interval_5s" },
  { sec: 15, label: "15s", nameKey: "power_curve.interval_15s" },
  { sec: 30, label: "30s", nameKey: "power_curve.interval_30s" },
  { sec: 60, label: "1m", nameKey: "power_curve.interval_1m" },
  { sec: 120, label: "2m", nameKey: "power_curve.interval_2m" },
  { sec: 300, label: "5m", nameKey: "power_curve.interval_5m" },
  { sec: 600, label: "10m", nameKey: "power_curve.interval_10m" },
  { sec: 1200, label: "20m", nameKey: "power_curve.interval_20m" },
  { sec: 1800, label: "30m", nameKey: "power_curve.interval_30m" },
  { sec: 3600, label: "60m", nameKey: "power_curve.interval_60m" },
];

/**
 * Normaliza os trackpoints em uma série temporal de potência segundo a segundo.
 */
function buildSecondBySecondPowerSeries(
  points: TrackPoint[],
  durationSec: number,
  startedAt?: string
): number[] {
  if (!points || points.length === 0) return [];

  // Verificar se há timestamps reais
  const hasTimestamps = points.some((p) => p.timestamp != null);
  const startMs = startedAt
    ? new Date(startedAt).getTime()
    : points[0].timestamp
    ? new Date(points[0].timestamp).getTime()
    : 0;

  const totalSec = Math.max(
    1,
    durationSec ||
      (points[points.length - 1].timestamp && points[0].timestamp
        ? Math.round(
            (new Date(points[points.length - 1].timestamp!).getTime() -
              new Date(points[0].timestamp!).getTime()) /
              1000
          )
        : points.length)
  );

  const series: number[] = new Array(totalSec).fill(0);
  const counts: number[] = new Array(totalSec).fill(0);

  if (hasTimestamps) {
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (!p.timestamp) continue;
      const tMs = new Date(p.timestamp).getTime();
      const sec = Math.min(totalSec - 1, Math.max(0, Math.round((tMs - startMs) / 1000)));
      const w = p.watts != null && Number.isFinite(p.watts) ? Math.max(0, p.watts) : 0;
      series[sec] += w;
      counts[sec] += 1;
    }
  } else {
    // Interpolação linear quando não há timestamps absolutos
    const step = points.length > 1 ? (totalSec - 1) / (points.length - 1) : 1;
    for (let i = 0; i < points.length; i++) {
      const sec = Math.min(totalSec - 1, Math.max(0, Math.round(i * step)));
      const w = points[i].watts != null && Number.isFinite(points[i].watts) ? Math.max(0, points[i].watts!) : 0;
      series[sec] += w;
      counts[sec] += 1;
    }
  }

  // Preencher lacunas por interpolação do último valor conhecido
  let lastW = 0;
  for (let s = 0; s < totalSec; s++) {
    if (counts[s] > 0) {
      series[s] = series[s] / counts[s];
      lastW = series[s];
    } else {
      series[s] = lastW;
    }
  }

  return series;
}

/**
 * Calcula a Potência Média Máxima (MMP) para uma janela de duração de `windowSec` segundos.
 */
function calculateMeanMaximalPowerForDuration(
  series: number[],
  windowSec: number
): { bestWatts: number; startSec: number } | null {
  if (series.length < windowSec || windowSec <= 0) return null;

  let currentSum = 0;
  for (let i = 0; i < windowSec; i++) {
    currentSum += series[i];
  }

  let maxSum = currentSum;
  let bestStart = 0;

  for (let i = windowSec; i < series.length; i++) {
    currentSum += series[i] - series[i - windowSec];
    if (currentSum > maxSum) {
      maxSum = currentSum;
      bestStart = i - windowSec + 1;
    }
  }

  const bestWatts = Math.round(maxSum / windowSec);
  return { bestWatts, startSec: bestStart };
}

/**
 * Analisa a atividade de ciclismo e gera a Curva de Potência-Duração completa
 * juntamente com os Melhores Esforços de Potência de destaque.
 */
export function calculateActivityPowerCurve(
  activity: ActivityDetail,
  userFtpWatts?: number,
  userWeightKg?: number
): PowerCurveAnalysis {
  const pointsWithPower = (activity.points || []).filter(
    (p) => p.watts != null && Number.isFinite(p.watts) && p.watts > 0
  );

  const hasPower = pointsWithPower.length >= 5 || (activity.avgWatts != null && activity.avgWatts > 0);

  if (!hasPower) {
    return {
      hasPower: false,
      maxWatts: activity.maxWatts || 0,
      avgWatts: activity.avgWatts || 0,
      points: [],
      peakEfforts: [],
    };
  }

  const durationSec = Math.max(activity.durationSec || 1, activity.movingTimeSec || 1);
  const powerSeries = buildSecondBySecondPowerSeries(activity.points, durationSec, activity.startedAt);

  const curvePoints: PowerCurvePoint[] = [];
  const peakEfforts: PeakPowerEffort[] = [];

  for (const interval of STANDARD_INTERVALS) {
    if (interval.sec > powerSeries.length) continue;

    const result = calculateMeanMaximalPowerForDuration(powerSeries, interval.sec);
    if (!result) continue;

    const watts = result.bestWatts;
    const wattsPerKg =
      userWeightKg && userWeightKg > 0 ? Number((watts / userWeightKg).toFixed(2)) : undefined;
    const percentFtp =
      userFtpWatts && userFtpWatts > 0 ? Math.round((watts / userFtpWatts) * 100) : undefined;

    curvePoints.push({
      durationSec: interval.sec,
      label: interval.label,
      watts,
      wattsPerKg,
      percentFtp,
    });

    // Melhores Esforços Principais (5s, 30s, 1m, 5m, 20m, 60m)
    if ([5, 30, 60, 300, 1200, 3600].includes(interval.sec)) {
      peakEfforts.push({
        key: `peak_${interval.label}`,
        durationSec: interval.sec,
        label: interval.label,
        nameKey: interval.nameKey,
        watts,
        wattsPerKg,
        percentFtp,
        startTimeSec: result.startSec,
        endTimeSec: result.startSec + interval.sec,
      });
    }
  }

  const maxWatts = Math.max(activity.maxWatts || 0, ...curvePoints.map((p) => p.watts));
  const avgWatts = activity.avgWatts || (powerSeries.length > 0 ? Math.round(powerSeries.reduce((a, b) => a + b, 0) / powerSeries.length) : 0);

  return {
    hasPower: true,
    maxWatts,
    avgWatts,
    points: curvePoints,
    peakEfforts,
  };
}
