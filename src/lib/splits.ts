import type { TrackPoint } from "./types";
import { haversineM } from "./geo";

export interface Split {
  km: number;
  durationSec: number;
  paceSecKm: number;
  speedKmh?: number;
  elevationGainM: number;
  avgHr?: number;
  avgWatts?: number;
}

export function calculateSplits(points: TrackPoint[]): Split[] {
  if (points.length < 2) return [];

  const splits: Split[] = [];
  let currentSplitKm = 1;

  let splitDistance = 0;
  let splitDuration = 0;
  let splitElevation = 0;
  let splitHrs: number[] = [];
  let splitWatts: number[] = [];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    const segDist = haversineM(prev.lat, prev.lng, curr.lat, curr.lng);
    const segDuration =
      prev.timestamp && curr.timestamp
        ? (curr.timestamp.getTime() - prev.timestamp.getTime()) / 1000
        : 0;
    const segElevation =
      prev.elevation != null && curr.elevation != null && curr.elevation > prev.elevation
        ? curr.elevation - prev.elevation
        : 0;

    let remainingDist = segDist;
    let remainingDuration = segDuration;
    let remainingElevation = segElevation;

    while (splitDistance + remainingDist >= 1000) {
      const neededDist = 1000 - splitDistance;
      const ratio = remainingDist > 0 ? neededDist / remainingDist : 0;

      const partDuration = remainingDuration * ratio;
      const partElevation = remainingElevation * ratio;

      splitDistance += neededDist;
      splitDuration += partDuration;
      splitElevation += partElevation;

      if (curr.hr != null) {
        splitHrs.push(curr.hr);
      }
      if (curr.watts != null) {
        splitWatts.push(curr.watts);
      }

      const speedKmh = splitDuration > 0 ? (1000 / splitDuration) * 3.6 : 0;

      splits.push({
        km: currentSplitKm,
        durationSec: splitDuration,
        paceSecKm: splitDuration, // para exatamente 1 km, ritmo (s/km) é igual ao tempo (s)
        speedKmh: Number(speedKmh.toFixed(1)),
        elevationGainM: splitElevation,
        avgHr: splitHrs.length
          ? Math.round(splitHrs.reduce((a, b) => a + b, 0) / splitHrs.length)
          : undefined,
        avgWatts: splitWatts.length
          ? Math.round(splitWatts.reduce((a, b) => a + b, 0) / splitWatts.length)
          : undefined,
      });

      currentSplitKm += 1;
      splitDistance = 0;
      splitDuration = 0;
      splitElevation = 0;
      splitHrs = [];
      splitWatts = [];

      remainingDist -= neededDist;
      remainingDuration -= partDuration;
      remainingElevation -= partElevation;
    }

    splitDistance += remainingDist;
    splitDuration += remainingDuration;
    splitElevation += remainingElevation;

    if (curr.hr != null) {
      splitHrs.push(curr.hr);
    }
    if (curr.watts != null) {
      splitWatts.push(curr.watts);
    }
  }

  // Se houver uma fração restante significativa, adicionamos como última parcial
  if (splitDistance > 10) {
    const finalKm = currentSplitKm - 1 + splitDistance / 1000;
    const pace = splitDistance > 0 ? (splitDuration / splitDistance) * 1000 : 0;
    const speedKmh = splitDuration > 0 ? (splitDistance / splitDuration) * 3.6 : 0;
    splits.push({
      km: finalKm,
      durationSec: splitDuration,
      paceSecKm: pace,
      speedKmh: Number(speedKmh.toFixed(1)),
      elevationGainM: splitElevation,
      avgHr: splitHrs.length
        ? Math.round(splitHrs.reduce((a, b) => a + b, 0) / splitHrs.length)
        : undefined,
      avgWatts: splitWatts.length
        ? Math.round(splitWatts.reduce((a, b) => a + b, 0) / splitWatts.length)
        : undefined,
    });
  }

  return splits;
}
