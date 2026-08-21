import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ParsedActivity, Sport, TrackPoint } from "./types";
import { distanceFromPoints, elevationGainFromPoints, haversineM } from "./geo";
import { computeMovingTimeFromPoints } from "./auto-pause";

const MIN_ACCURACY_M = 80;
const MIN_SEGMENT_M = 4;
const MAX_RUN_SPEED_MS = 12; // ~43 km/h — filtra saltos GPS

export function shouldAcceptPoint(
  points: TrackPoint[],
  candidate: TrackPoint
): boolean {
  if (candidate.lat == null || candidate.lng == null) return false;

  const last = points[points.length - 1];
  if (!last) return true;

  const dist = haversineM(last.lat, last.lng, candidate.lat, candidate.lng);
  const dt =
    candidate.timestamp && last.timestamp
      ? (candidate.timestamp.getTime() - last.timestamp.getTime()) / 1000
      : 0;

  if (dt > 0 && dist / dt > MAX_RUN_SPEED_MS) return false;
  if (dist < MIN_SEGMENT_M && points.length > 0) return false;

  return true;
}

export function buildRecordedActivity(
  sport: Sport,
  startedAt: Date,
  endedAt: Date,
  points: TrackPoint[],
  recordedMovingSec?: number
): ParsedActivity {
  const durationSec = Math.max(
    1,
    (endedAt.getTime() - startedAt.getTime()) / 1000
  );
  const distanceM = distanceFromPoints(points);
  const elevationGainM = elevationGainFromPoints(points);

  let movingTimeSec: number;
  if (recordedMovingSec != null && recordedMovingSec > 0) {
    movingTimeSec = Math.min(durationSec, Math.round(recordedMovingSec));
  } else {
    const analysis = computeMovingTimeFromPoints(points);
    movingTimeSec = analysis.movingTimeSec > 0 ? analysis.movingTimeSec : durationSec;
  }

  let avgPaceSecKm: number | undefined;
  if (distanceM > 0) {
    // Ritmo médio baseado no tempo em movimento
    const effectiveSec = movingTimeSec > 0 ? movingTimeSec : durationSec;
    avgPaceSecKm = (effectiveSec / distanceM) * 1000;
  }

  const hrPoints = points.filter((p) => p.hr != null);
  let avgHr: number | undefined;
  let maxHr: number | undefined;
  if (hrPoints.length > 0) {
    const hrValues = hrPoints.map((p) => p.hr as number);
    avgHr = Math.round(hrValues.reduce((acc, v) => acc + v, 0) / hrValues.length);
    maxHr = Math.max(...hrValues);
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
    points,
  };
}

export function validateRecordedWorkout(
  points: TrackPoint[],
  durationSec: number
): string | null {
  if (points.length < 2) {
    return "Poucos pontos GPS. Aguarde o sinal e tente de novo.";
  }
  if (durationSec < 15) {
    return "Treino muito curto (mínimo 15 segundos).";
  }
  const distanceM = distanceFromPoints(points);
  if (distanceM < 20) {
    return "Distância muito curta (mínimo 20 metros).";
  }
  return null;
}

export function acceptGpsReading(accuracy?: number): boolean {
  if (accuracy == null) return true;
  return accuracy <= MIN_ACCURACY_M;
}
