import { haversineM } from "./geo";
import type { ActivityDetail, TrackPoint } from "./types";

export interface ChartPoint {
  x: number;
  y: number;
  label?: string;
}

export interface PaceKmPoint {
  km: number;
  paceSecKm: number;
}

function ensureTimestamps(
  points: TrackPoint[],
  startedAt: string,
  durationSec: number
): TrackPoint[] {
  if (points.every((p) => p.timestamp)) return points;
  const startMs = new Date(startedAt).getTime();
  const stepMs =
    points.length > 1 ? (durationSec * 1000) / (points.length - 1) : 0;
  return points.map((p, i) => ({
    ...p,
    timestamp: p.timestamp ?? new Date(startMs + i * stepMs),
  }));
}

export function cumulativeDistances(points: TrackPoint[]): number[] {
  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(
      cum[i - 1] +
        haversineM(
          points[i - 1].lat,
          points[i - 1].lng,
          points[i].lat,
          points[i].lng
        )
    );
  }
  return cum;
}

/** Ritmo médio por quilômetro completo. */
export function computePaceByKm(
  activity: ActivityDetail,
  cumDist?: number[]
): PaceKmPoint[] {
  const points = ensureTimestamps(
    activity.points,
    activity.startedAt,
    activity.durationSec
  );
  if (points.length < 2) return [];

  const cum = cumDist ?? cumulativeDistances(points);
  const totalKm = cum[cum.length - 1] / 1000;
  if (totalKm < 0.3) return [];

  const fullKm = Math.floor(totalKm);
  const result: PaceKmPoint[] = [];

  for (let km = 1; km <= fullKm; km++) {
    const startM = (km - 1) * 1000;
    const endM = km * 1000;
    let segStart: TrackPoint | null = null;
    let segEnd: TrackPoint | null = null;

    for (let i = 0; i < points.length; i++) {
      if (cum[i] >= startM && !segStart) segStart = points[i];
      if (cum[i] >= endM) {
        segEnd = points[i];
        break;
      }
    }
    if (!segStart || !segEnd?.timestamp || !segStart.timestamp) continue;

    const dt =
      (segEnd.timestamp.getTime() - segStart.timestamp.getTime()) / 1000;
    const dist = endM - startM;
    if (dt > 0 && dist > 0) {
      result.push({ km, paceSecKm: (dt / dist) * 1000 });
    }
  }

  return result;
}

/** Elevação ao longo da distância (amostragem). */
export function computeElevationSeries(
  activity: ActivityDetail,
  maxPoints = 120,
  cumDist?: number[]
): ChartPoint[] {
  const points = activity.points.filter(
    (p) => p.elevation != null && Number.isFinite(p.elevation)
  );
  if (points.length < 2) return [];

  const all = activity.points;
  const cum = cumDist ?? cumulativeDistances(all);
  const series: ChartPoint[] = [];

  for (let i = 0; i < all.length; i++) {
    const ele = all[i].elevation;
    if (ele != null && Number.isFinite(ele)) {
      series.push({
        x: cum[i] / 1000,
        y: ele,
      });
    }
  }

  if (series.length <= maxPoints) return series;
  const step = Math.ceil(series.length / maxPoints);
  const sampled: ChartPoint[] = [];
  for (let i = 0; i < series.length; i += step) {
    sampled.push(series[i]);
  }
  const last = series[series.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}

/** FC ao longo da distância (km). */
export function computeHeartRateSeries(
  activity: ActivityDetail,
  maxPoints = 120,
  cumDist?: number[]
): ChartPoint[] {
  const all = activity.points;
  const cum = cumDist ?? cumulativeDistances(all);
  const series: ChartPoint[] = [];

  for (let i = 0; i < all.length; i++) {
    const hr = all[i].hr;
    if (hr != null && hr > 0) {
      series.push({ x: cum[i] / 1000, y: hr });
    }
  }

  if (series.length < 2) return [];
  if (series.length <= maxPoints) return series;

  const step = Math.ceil(series.length / maxPoints);
  const sampled: ChartPoint[] = [];
  for (let i = 0; i < series.length; i += step) {
    sampled.push(series[i]);
  }
  const last = series[series.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}

/** Ritmo instantâneo suavizado por distância (quando não há km completo). */
export function computePaceSeries(
  activity: ActivityDetail,
  maxPoints = 80,
  cumDist?: number[]
): ChartPoint[] {
  const points = ensureTimestamps(
    activity.points,
    activity.startedAt,
    activity.durationSec
  );
  if (points.length < 3) return [];

  const cum = cumDist ?? cumulativeDistances(points);
  const raw: ChartPoint[] = [];

  for (let i = 2; i < points.length; i++) {
    const dt =
      (points[i].timestamp!.getTime() -
        points[i - 2].timestamp!.getTime()) /
      1000;
    const dist = cum[i] - cum[i - 2];
    if (dt > 2 && dist > 15) {
      const pace = (dt / dist) * 1000;
      if (pace >= 120 && pace <= 900) {
        raw.push({ x: cum[i] / 1000, y: pace });
      }
    }
  }

  if (raw.length <= maxPoints) return raw;
  const step = Math.ceil(raw.length / maxPoints);
  const sampled: ChartPoint[] = [];
  for (let i = 0; i < raw.length; i += step) sampled.push(raw[i]);
  return sampled;
}

export interface SpeedKmPoint {
  km: number;
  speedKmh: number;
}

/** Velocidade média por quilômetro completo (km/h). */
export function computeSpeedByKm(
  activity: ActivityDetail,
  cumDist?: number[]
): SpeedKmPoint[] {
  const points = ensureTimestamps(
    activity.points,
    activity.startedAt,
    activity.durationSec
  );
  if (points.length < 2) return [];

  const cum = cumDist ?? cumulativeDistances(points);
  const totalKm = cum[cum.length - 1] / 1000;
  if (totalKm < 0.3) return [];

  const fullKm = Math.floor(totalKm);
  const result: SpeedKmPoint[] = [];

  for (let km = 1; km <= fullKm; km++) {
    const startM = (km - 1) * 1000;
    const endM = km * 1000;
    let segStart: TrackPoint | null = null;
    let segEnd: TrackPoint | null = null;

    for (let i = 0; i < points.length; i++) {
      if (cum[i] >= startM && !segStart) segStart = points[i];
      if (cum[i] >= endM) {
        segEnd = points[i];
        break;
      }
    }
    if (!segStart || !segEnd?.timestamp || !segStart.timestamp) continue;

    const dt =
      (segEnd.timestamp.getTime() - segStart.timestamp.getTime()) / 1000;
    const dist = endM - startM;
    if (dt > 0 && dist > 0) {
      const speedKmh = (dist / dt) * 3.6;
      result.push({ km, speedKmh: Number(speedKmh.toFixed(1)) });
    }
  }

  return result;
}

/** Velocidade ao longo da distância (km/h). */
export function computeSpeedSeries(
  activity: ActivityDetail,
  maxPoints = 120,
  cumDist?: number[]
): ChartPoint[] {
  const points = ensureTimestamps(
    activity.points,
    activity.startedAt,
    activity.durationSec
  );
  if (points.length < 3) return [];

  const cum = cumDist ?? cumulativeDistances(points);
  const raw: ChartPoint[] = [];

  for (let i = 2; i < points.length; i++) {
    const dt =
      (points[i].timestamp!.getTime() -
        points[i - 2].timestamp!.getTime()) /
      1000;
    const dist = cum[i] - cum[i - 2];
    if (dt > 1 && dist > 5) {
      const speedKmh = (dist / dt) * 3.6;
      if (speedKmh >= 0 && speedKmh <= 120) {
        raw.push({ x: cum[i] / 1000, y: Number(speedKmh.toFixed(1)) });
      }
    }
  }

  if (raw.length <= maxPoints) return raw;
  const step = Math.ceil(raw.length / maxPoints);
  const sampled: ChartPoint[] = [];
  for (let i = 0; i < raw.length; i += step) sampled.push(raw[i]);
  return sampled;
}

/** Potência em Watts ao longo da distância. */
export function computePowerSeries(
  activity: ActivityDetail,
  maxPoints = 120,
  cumDist?: number[]
): ChartPoint[] {
  const all = activity.points;
  const cum = cumDist ?? cumulativeDistances(all);
  const series: ChartPoint[] = [];

  for (let i = 0; i < all.length; i++) {
    const w = all[i].watts;
    if (w != null && Number.isFinite(w) && w >= 0) {
      series.push({ x: cum[i] / 1000, y: Math.round(w) });
    }
  }

  if (series.length < 2) return [];
  if (series.length <= maxPoints) return series;

  const step = Math.ceil(series.length / maxPoints);
  const sampled: ChartPoint[] = [];
  for (let i = 0; i < series.length; i += step) {
    sampled.push(series[i]);
  }
  const last = series[series.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}
