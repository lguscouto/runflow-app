import type { RoutePoint } from "./types";
import { haversineM } from "./geo";

/**
 * Calculate the total distance of a route in meters using the haversine formula.
 */
export function routeDistanceM(points: RoutePoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    total += haversineM(a.lat, a.lng, b.lat, b.lng);
  }
  return total;
}

/**
 * Calculate the minimum distance from a point (px, py) to a line segment
 * defined by endpoints (ax, ay) and (bx, by), all in lat/lng degrees.
 * Returns distance in meters using haversine.
 */
export function pointToSegmentDistanceM(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  // Project point onto segment in lat/lng space
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // Segment is a single point
    return haversineM(px, py, ax, ay);
  }

  // Parameter t clamped to [0, 1]
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  // Snapped point on segment
  const snappedLat = ax + t * dx;
  const snappedLng = ay + t * dy;

  return haversineM(px, py, snappedLat, snappedLng);
}

/**
 * Calculate the minimum distance from a point to a polyline (array of RoutePoints).
 * Returns the distance in meters, the index of the closest segment, and the snapped point.
 */
export function pointToPolylineDistanceM(
  point: RoutePoint,
  polyline: RoutePoint[]
): { distanceM: number; segmentIndex: number; snappedPoint: RoutePoint } {
  if (polyline.length === 0) {
    return {
      distanceM: Infinity,
      segmentIndex: -1,
      snappedPoint: point,
    };
  }

  if (polyline.length === 1) {
    return {
      distanceM: haversineM(point.lat, point.lng, polyline[0].lat, polyline[0].lng),
      segmentIndex: 0,
      snappedPoint: polyline[0],
    };
  }

  let minDist = Infinity;
  let bestSegment = 0;
  let bestSnapped: RoutePoint = polyline[0];

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];

    const dx = b.lat - a.lat;
    const dy = b.lng - a.lng;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq !== 0) {
      t = ((point.lat - a.lat) * dx + (point.lng - a.lng) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }

    const snappedLat = a.lat + t * dx;
    const snappedLng = a.lng + t * dy;
    const dist = haversineM(point.lat, point.lng, snappedLat, snappedLng);

    if (dist < minDist) {
      minDist = dist;
      bestSegment = i;
      bestSnapped = { lat: snappedLat, lng: snappedLng };
    }
  }

  return {
    distanceM: minDist,
    segmentIndex: bestSegment,
    snappedPoint: bestSnapped,
  };
}

/**
 * Check if a point is within tolerance meters of a polyline (route).
 */
export function isOnRoute(
  point: RoutePoint,
  polyline: RoutePoint[],
  toleranceM: number
): boolean {
  const { distanceM } = pointToPolylineDistanceM(point, polyline);
  return distanceM <= toleranceM;
}
