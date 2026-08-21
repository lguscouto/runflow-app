import type { AutoPauseConfig, TrackPoint } from "./types";
import { haversineM } from "./geo";

export const DEFAULT_AUTO_PAUSE_CONFIG: AutoPauseConfig = {
  enabled: true,
  minSpeedKmh: 1.5, // 1.5 km/h (≈ 40:00/km) — padrão da indústria (Strava / Garmin)
  pauseDelaySec: 3, // 3 segundos de baixa velocidade para confirmar parada
  audioFeedback: true, // Notificar "Treino pausado automaticamente" / "Treino retomado"
};

/**
 * Calcula a velocidade instantânea em km/h com base nos últimos pontos de GPS.
 */
export function computeInstantSpeedKmh(
  points: TrackPoint[],
  windowSec = 4
): number {
  if (points.length < 2) return 0;

  const lastPoint = points[points.length - 1];
  if (!lastPoint.timestamp) return 0;

  const lastTime = lastPoint.timestamp.getTime();
  let windowDistanceM = 0;
  let oldestTime = lastTime;

  for (let i = points.length - 1; i >= 1; i--) {
    const current = points[i];
    const prev = points[i - 1];
    if (!current.timestamp || !prev.timestamp) continue;

    const dt = (lastTime - prev.timestamp.getTime()) / 1000;
    if (dt > windowSec && windowDistanceM > 0) break;

    const segDist = haversineM(prev.lat, prev.lng, current.lat, current.lng);
    windowDistanceM += segDist;
    oldestTime = prev.timestamp.getTime();
  }

  const totalDt = (lastTime - oldestTime) / 1000;
  if (totalDt <= 0.5) return 0;

  const speedMs = windowDistanceM / totalDt;
  return speedMs * 3.6; // m/s -> km/h
}

/**
 * Calcula o tempo em movimento (Moving Time) e o ritmo médio real a partir de uma trilha de TrackPoints.
 * Considera segmentos com velocidade acima de minSpeedKmh e intervalos temporais válidos.
 */
export function computeMovingTimeFromPoints(
  points: TrackPoint[],
  minSpeedKmh = 1.5
): {
  movingTimeSec: number;
  elapsedTimeSec: number;
  movingDistanceM: number;
  movingAvgPaceSecKm: number | null;
} {
  if (points.length < 2) {
    return {
      movingTimeSec: 0,
      elapsedTimeSec: 0,
      movingDistanceM: 0,
      movingAvgPaceSecKm: null,
    };
  }

  const minSpeedMs = minSpeedKmh / 3.6;
  let movingTimeSec = 0;
  let movingDistanceM = 0;

  const firstTime = points[0].timestamp?.getTime();
  const lastTime = points[points.length - 1].timestamp?.getTime();
  const elapsedTimeSec =
    firstTime && lastTime && lastTime >= firstTime
      ? Math.round((lastTime - firstTime) / 1000)
      : 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    const segDist = haversineM(prev.lat, prev.lng, curr.lat, curr.lng);
    const dt =
      curr.timestamp && prev.timestamp
        ? (curr.timestamp.getTime() - prev.timestamp.getTime()) / 1000
        : 0;

    // Se o intervalo entre pontos for realista (entre 0.5s e 30s) e velocidade >= limiar
    if (dt > 0.4 && dt <= 30) {
      const segSpeedMs = segDist / dt;
      if (segSpeedMs >= minSpeedMs) {
        movingTimeSec += dt;
        movingDistanceM += segDist;
      }
    } else if (segDist >= 2) {
      // Se não há timestamp preciso, mas houve deslocamento
      movingDistanceM += segDist;
      if (dt > 0 && dt <= 30) {
        movingTimeSec += dt;
      }
    }
  }

  // Arredonda movingTimeSec e garante que não ultrapasse o tempo total
  movingTimeSec = Math.round(movingTimeSec);
  if (elapsedTimeSec > 0 && (movingTimeSec <= 0 || movingTimeSec > elapsedTimeSec)) {
    movingTimeSec = elapsedTimeSec;
  }

  const movingAvgPaceSecKm =
    movingDistanceM > 10 && movingTimeSec > 0
      ? (movingTimeSec / movingDistanceM) * 1000
      : null;

  return {
    movingTimeSec: Math.max(1, movingTimeSec),
    elapsedTimeSec: Math.max(1, elapsedTimeSec),
    movingDistanceM,
    movingAvgPaceSecKm,
  };
}

/**
 * Toca áudio ou vibração sutil ao pausar/retomar via Auto-Pause
 */
export function playAutoPauseSound(isPaused: boolean, language = "pt") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  try {
    const text = isPaused
      ? language === "pt"
        ? "Treino pausado automaticamente"
        : "Workout auto-paused"
      : language === "pt"
      ? "Treino retomado"
      : "Workout resumed";

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "pt" ? "pt-BR" : "en-US";
    utterance.rate = 1.1;
    utterance.volume = 0.9;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Silently ignore if audio is blocked or unavailable
  }
}
