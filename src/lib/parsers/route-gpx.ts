import type { RoutePoint, SavedRoute } from "../types";
import { parseTrackPoints } from "./gpx";
import { routeDistanceM } from "../route-geo";

export function importRouteGpx(content: string, fileName: string): SavedRoute {
  const points: RoutePoint[] = parseTrackPoints(content);

  if (points.length < 2) {
    throw new Error("GPX sem pontos de trajeto suficientes.");
  }

  const nameMatch = content.match(/<name>([^<]*)<\/name>/i);
  const name = nameMatch?.[1]?.trim() || fileName.replace(/\.gpx$/i, "");

  const distanceM = routeDistanceM(points);

  return {
    id: crypto.randomUUID(),
    name,
    points,
    distanceM,
    source: "imported",
    createdAt: new Date().toISOString(),
  };
}
