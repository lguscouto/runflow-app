import type { TrackPoint } from "./types";

const EARTH_RADIUS_M = 6371000;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function distanceFromPoints(points: TrackPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    total += haversineM(a.lat, a.lng, b.lat, b.lng);
  }
  return total;
}

export function elevationGainFromPoints(points: TrackPoint[]): number {
  let gain = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].elevation;
    const curr = points[i].elevation;
    if (prev != null && curr != null && curr > prev) {
      gain += curr - prev;
    }
  }
  return gain;
}

export function simplifyPoints<T extends { lat: number; lng: number }>(
  points: T[],
  maxPoints = 800
): T[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const simplified: T[] = [];
  for (let i = 0; i < points.length; i += step) {
    simplified.push(points[i]);
  }
  const last = points[points.length - 1];
  if (simplified[simplified.length - 1] !== last) {
    simplified.push(last);
  }
  return simplified;
}

export function boundsFromPoints<T extends { lat: number; lng: number }>(points: T[]) {
  if (points.length === 0) {
    return { south: -23.55, west: -46.63, north: -23.55, east: -46.63 };
  }
  let south = points[0].lat;
  let north = points[0].lat;
  let west = points[0].lng;
  let east = points[0].lng;
  for (const p of points) {
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
  }
  return { south, west, north, east };
}
