import {
  getStore,
  listStoredActivitiesPaged,
  type StoredActivityTrack,
} from "./storage";
import { simplifyPoints } from "./geo";
import type { ActivitySummary, Sport } from "./types";

export interface HeatmapTrack {
  id: string;
  name: string;
  sport: Sport;
  startedAt: string;
  distanceM: number;
  durationSec: number;
  avgPaceSecKm: number | null;
  avgSpeedKmh?: number | null;
  avgWatts?: number | null;
  points: [number, number][];
  isRoute?: boolean;
}

export interface HeatmapBatchOptions {
  batchSize?: number;
  signal?: AbortSignal;
  filter?: (summary: ActivitySummary) => boolean;
}

export interface HeatmapBatchResult {
  activities: number;
  renderedPoints: number;
  availableYears: string[];
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;

  if (typeof DOMException !== "undefined") {
    throw new DOMException("Heatmap processing aborted", "AbortError");
  }

  const error = new Error("Heatmap processing aborted");
  error.name = "AbortError";
  throw error;
}

function toHeatmapTrack(
  summary: ActivitySummary,
  track: StoredActivityTrack,
): HeatmapTrack | null {
  if (!Array.isArray(track.points) || track.points.length < 2) return null;

  const simplified = simplifyPoints(track.points, 400);
  const points: [number, number][] = simplified.map((point) => [point.lat, point.lng]);
  if (points.length < 2) return null;

  return {
    id: summary.id,
    name: summary.name,
    sport: summary.sport,
    startedAt: summary.startedAt,
    distanceM: summary.distanceM,
    durationSec: summary.durationSec,
    avgPaceSecKm: summary.avgPaceSecKm,
    avgSpeedKmh: summary.avgSpeedKmh,
    avgWatts: summary.avgWatts,
    points,
    isRoute: false,
  };
}

/**
 * Lê summaries por cursor e processa tracks em lotes curtos.
 * O consumidor recebe cada lote; o resultado mantém contadores e os anos
 * disponíveis derivados dos summaries, sem carregar tracks fora do filtro.
 */
export async function forEachHeatmapBatch(
  options: HeatmapBatchOptions = {},
  consume: (batch: HeatmapTrack[]) => void | Promise<void>,
): Promise<HeatmapBatchResult> {
  const batchSize = options.batchSize ?? 25;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 200) {
    throw new RangeError("Heatmap batchSize must be an integer between 1 and 200");
  }

  const db = await getStore();
  let cursor = null;
  let processedActivities = 0;
  let renderedPoints = 0;
  const availableYears = new Set<string>();

  while (true) {
    throwIfAborted(options.signal);
    const page = await listStoredActivitiesPaged(batchSize, cursor);
    processedActivities += page.items.length;
    for (const summary of page.items) {
      const year = new Date(summary.startedAt).getFullYear();
      if (Number.isFinite(year)) availableYears.add(year.toString());
    }

    const summaries = options.filter
      ? page.items.filter(options.filter)
      : page.items;
    const trackTx = db.transaction("activityTracks", "readonly");
    const trackStore = trackTx.objectStore("activityTracks");
    const rawTracks = await Promise.all(
      summaries.map((summary) => trackStore.get(summary.id)),
    );
    await trackTx.done;

    const batch: HeatmapTrack[] = [];
    for (let index = 0; index < summaries.length; index += 1) {
      throwIfAborted(options.signal);
      const rawTrack = rawTracks[index];
      if (!rawTrack) continue;
      const heatmapTrack = toHeatmapTrack(summaries[index], rawTrack);
      if (!heatmapTrack) continue;
      renderedPoints += heatmapTrack.points.length;
      batch.push(heatmapTrack);
    }

    if (batch.length > 0) {
      await consume(batch);
      throwIfAborted(options.signal);
    }

    if (!page.hasMore || !page.nextCursor) break;
    cursor = page.nextCursor;
  }

  return {
    activities: processedActivities,
    renderedPoints,
    availableYears: Array.from(availableYears).sort((a, b) => Number(b) - Number(a)),
  };
}
