import { getStore } from "./storage";
import { simplifyPoints } from "./geo";
import type { ActivitySummary, TrackPoint } from "./types";

export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity?: number;
}

/**
 * Carrega e processa pontos de mapa de calor em lotes paginados,
 * evitando retenção de dezenas de megabytes de objetos na heap V8.
 */
export async function streamHeatmapPoints(
  batchSize = 25,
  onBatch?: (points: HeatmapPoint[]) => void
): Promise<HeatmapPoint[]> {
  const db = await getStore();
  const tx = db.transaction(["activitySummaries", "activityTracks"], "readonly");
  const summaryStore = tx.objectStore("activitySummaries");
  const trackStore = tx.objectStore("activityTracks");

  const allSummaries = await summaryStore.getAll();
  const allHeatmapPoints: HeatmapPoint[] = [];

  for (let i = 0; i < allSummaries.length; i += batchSize) {
    const batchSummaries = allSummaries.slice(i, i + batchSize);
    const batchPoints: HeatmapPoint[] = [];

    for (const sum of batchSummaries) {
      const track = await trackStore.get(sum.id);
      if (track && track.points && track.points.length > 0) {
        // Simplifica trilha para renderização rápida em mapa de calor
        const simplified = simplifyPoints(track.points, 400);
        for (const pt of simplified) {
          batchPoints.push({
            lat: pt.lat,
            lng: pt.lng,
            intensity: 1.0,
          });
        }
      }
    }

    if (batchPoints.length > 0) {
      allHeatmapPoints.push(...batchPoints);
      onBatch?.(batchPoints);
    }
  }

  return allHeatmapPoints;
}
