import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ParsedActivity, Sport, TrackPoint } from "./types";
import { haversineM } from "./geo";
import { computeMovingTimeFromPoints } from "./auto-pause";

const MIN_ACCURACY_M = 80;
export const MIN_SEGMENT_M = 3;
const MAX_RUN_SPEED_MS = 12; // ~43 km/h para corrida/caminhada
const MAX_CYCLING_SPEED_MS = 32; // ~115 km/h para bike (descidas rápidas)

function hasValidCoordinates(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function hasValidTimestamp(timestamp?: Date): boolean {
  return timestamp == null || (timestamp instanceof Date && Number.isFinite(timestamp.getTime()));
}

function hasValidElevation(elevation?: number): boolean {
  return elevation == null || Number.isFinite(elevation);
}

function splitActivePointSegments(points: TrackPoint[]): TrackPoint[][] {
  const segments: TrackPoint[][] = [];
  let currentSegment: TrackPoint[] = [];

  for (const point of points) {
    if (point.autoPaused === true) {
      if (currentSegment.length > 0) segments.push(currentSegment);
      currentSegment = [];
      continue;
    }
    currentSegment.push(point);
  }

  if (currentSegment.length > 0) segments.push(currentSegment);
  return segments;
}

function distanceFromRecordedPoints(points: TrackPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const segment = haversineM(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
    if (segment >= MIN_SEGMENT_M) total += segment;
  }
  return total;
}

function elevationGainFromRecordedPoints(points: TrackPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const segment = haversineM(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
    const previousElevation = points[i - 1].elevation;
    const currentElevation = points[i].elevation;
    if (
      segment >= MIN_SEGMENT_M &&
      previousElevation != null &&
      currentElevation != null &&
      Number.isFinite(previousElevation) &&
      Number.isFinite(currentElevation) &&
      currentElevation > previousElevation
    ) {
      total += currentElevation - previousElevation;
    }
  }
  return total;
}

export interface ShouldAcceptPointOptions {
  allowStationary?: boolean;
}

export function shouldAcceptPoint(
  points: TrackPoint[],
  candidate: TrackPoint,
  sport: Sport = "running",
  options: ShouldAcceptPointOptions = {}
): boolean {
  if (
    !Number.isFinite(candidate.lat) ||
    !Number.isFinite(candidate.lng) ||
    !hasValidCoordinates(candidate.lat, candidate.lng) ||
    !hasValidElevation(candidate.elevation) ||
    !hasValidTimestamp(candidate.timestamp)
  ) return false;

  const last = points[points.length - 1];
  if (!last) return true;

  if (
    !Number.isFinite(last.lat) ||
    !Number.isFinite(last.lng) ||
    !hasValidCoordinates(last.lat, last.lng) ||
    !hasValidElevation(last.elevation) ||
    !hasValidTimestamp(last.timestamp)
  ) return false;

  const dist = haversineM(last.lat, last.lng, candidate.lat, candidate.lng);
  const dt =
    candidate.timestamp && last.timestamp
      ? (candidate.timestamp.getTime() - last.timestamp.getTime()) / 1000
      : 0;

  const maxSpeedMs = sport === "cycling" ? MAX_CYCLING_SPEED_MS : MAX_RUN_SPEED_MS;
  if (dt > 0 && dist / dt > maxSpeedMs) return false;
  if (
    dist < MIN_SEGMENT_M &&
    points.length > 0 &&
    candidate.autoPaused !== true &&
    !options.allowStationary
  ) return false;

  return true;
}

export function buildRecordedActivity(
  sport: Sport,
  startedAt: Date,
  endedAt: Date,
  points: TrackPoint[],
  recordedMovingSec?: number
): ParsedActivity {
  const activeSegments = splitActivePointSegments(points);
  const activePoints = activeSegments.flat();
  const durationSec = Math.max(
    1,
    (endedAt.getTime() - startedAt.getTime()) / 1000
  );
  const distanceM = activeSegments.reduce((total, segment) => total + distanceFromRecordedPoints(segment), 0);
  const elevationGainM = activeSegments.reduce(
    (total, segment) => total + elevationGainFromRecordedPoints(segment),
    0
  );

  let movingTimeSec: number;
  if (recordedMovingSec != null && recordedMovingSec > 0) {
    movingTimeSec = Math.min(durationSec, Math.round(recordedMovingSec));
  } else {
    const movingTimeFromSegments = activeSegments.reduce(
      (total, segment) => total + computeMovingTimeFromPoints(segment).movingTimeSec,
      0
    );
    movingTimeSec = movingTimeFromSegments > 0 ? movingTimeFromSegments : durationSec;
  }

  let avgPaceSecKm: number | undefined;
  if (distanceM > 0) {
    // Ritmo médio baseado no tempo em movimento
    const effectiveSec = movingTimeSec > 0 ? movingTimeSec : durationSec;
    avgPaceSecKm = (effectiveSec / distanceM) * 1000;
  }

  const hrPoints = activePoints.filter((p) => p.hr != null);
  let avgHr: number | undefined;
  let maxHr: number | undefined;
  if (hrPoints.length > 0) {
    const hrValues = hrPoints.map((p) => p.hr as number);
    avgHr = Math.round(hrValues.reduce((acc, v) => acc + v, 0) / hrValues.length);
    maxHr = Math.max(...hrValues);
  }

  // Métricas de Cadência (RPM) dos sensores BLE
  const cadencePoints = activePoints.filter((p) => p.cadence != null && p.cadence > 0);
  let avgCadenceRpm: number | undefined;
  let maxCadenceRpm: number | undefined;
  if (cadencePoints.length > 0) {
    const cadValues = cadencePoints.map((p) => p.cadence as number);
    avgCadenceRpm = Math.round(cadValues.reduce((acc, v) => acc + v, 0) / cadValues.length);
    maxCadenceRpm = Math.max(...cadValues);
  }

  // Métricas de Potência (Watts) dos sensores BLE
  const wattsPoints = activePoints.filter((p) => p.watts != null && p.watts > 0);
  let avgWatts: number | undefined;
  let maxWatts: number | undefined;
  if (wattsPoints.length > 0) {
    const wValues = wattsPoints.map((p) => p.watts as number);
    avgWatts = Math.round(wValues.reduce((acc, v) => acc + v, 0) / wValues.length);
    maxWatts = Math.max(...wValues);
  }

  const sportNames: Record<Sport, string> = {
    running: "Corrida",
    walking: "Caminhada",
    cycling: "Ciclismo",
    other: "Treino",
  };

  const name = `${sportNames[sport]} — ${format(startedAt, "d MMM yyyy, HH:mm", { locale: ptBR })}`;

  return {
    name,
    sport,
    startedAt,
    durationSec,
    movingTimeSec,
    elapsedTimeSec: durationSec,
    distanceM,
    avgPaceSecKm,
    elevationGainM,
    avgHr,
    maxHr,
    avgCadenceRpm,
    maxCadenceRpm,
    avgWatts,
    maxWatts,
    points: activePoints,
    trackSegments: activeSegments,
  };
}

export function validateRecordedWorkout(
  points: TrackPoint[],
  durationSec: number
): string | null {
  const activeSegments = splitActivePointSegments(points);
  const activePoints = activeSegments.flat();
  if (activePoints.length < 2) {
    return "Poucos pontos GPS. Aguarde o sinal e tente de novo.";
  }
  if (durationSec < 15) {
    return "Treino muito curto (mínimo 15 segundos).";
  }
  const distanceM = activeSegments.reduce((total, segment) => total + distanceFromRecordedPoints(segment), 0);
  if (distanceM < 20) {
    return "Distância muito curta (mínimo 20 metros).";
  }
  return null;
}

export function acceptGpsReading(accuracy?: number): boolean {
  if (accuracy == null) return true;
  return Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= MIN_ACCURACY_M;
}
