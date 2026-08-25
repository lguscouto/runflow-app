import type { RoutePoint, SavedRoute } from "@/lib/types";

function assertValidRouteCount(count: number): void {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError("synthetic route count must be a non-negative integer");
  }
}

function makeRoutePoints(seed = 0): RoutePoint[] {
  const offset = seed * 0.01;
  return [
    { lat: 1.2345 + offset, lng: -2.3456 - offset, elevation: 100 },
    { lat: 1.2355 + offset, lng: -2.3446 - offset, elevation: 108 },
    { lat: 1.2365 + offset, lng: -2.3436 - offset, elevation: 104 },
    { lat: 1.2375 + offset, lng: -2.3426 - offset, elevation: 116 },
  ];
}

export function makeSyntheticRoute(
  overrides: Partial<SavedRoute> = {}
): SavedRoute {
  return {
    id: "route-synthetic-01",
    name: "Rota sintética circular",
    points: makeRoutePoints(),
    distanceM: 5_000,
    elevationGainM: 20,
    source: "drawn",
    createdAt: "2026-08-20T12:00:00.000Z",
    sport: "running",
    color: "#22c55e",
    ...overrides,
  };
}

export const makeRoute = makeSyntheticRoute;

export function generateSyntheticRoutes(count: number): SavedRoute[] {
  assertValidRouteCount(count);
  return Array.from({ length: count }, (_, index) =>
    makeSyntheticRoute({
      id: `route-synthetic-${(index + 1).toString().padStart(2, "0")}`,
      name: `Rota sintética ${index + 1}`,
      points: makeRoutePoints(index),
    })
  );
}
