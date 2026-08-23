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

/**
 * Distância perpendicular aproximada (em metros) de um ponto P em relação ao segmento de reta AB.
 */
function perpendicularDistanceM<T extends { lat: number; lng: number }>(
  p: T,
  a: T,
  b: T
): number {
  // Projeção euclidiana local aproximada compensada pela latitude
  const latFactor = Math.cos(toRad((a.lat + b.lat) / 2));
  const x = (p.lng - a.lng) * latFactor;
  const y = p.lat - a.lat;
  const dx = (b.lng - a.lng) * latFactor;
  const dy = b.lat - a.lat;

  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return haversineM(p.lat, p.lng, a.lat, a.lng);
  }

  // Ponto de projeção normalizado t
  const t = Math.max(0, Math.min(1, (x * dx + y * dy) / lenSq));
  const projX = a.lng * latFactor + t * dx;
  const projY = a.lat + t * dy;

  const curX = p.lng * latFactor;
  const curY = p.lat;

  const degDist = Math.sqrt((curX - projX) ** 2 + (curY - projY) ** 2);
  // 1 grau ~ 111.319 metros no equador
  return degDist * 111319;
}

/**
 * Algoritmo Ramer-Douglas-Peucker (RDP) para simplificação geométrica de alta fidelidade.
 * Preserva esquinas, cotovelos e curvas de montanha sem deformação geométrica.
 */
export function douglasPeucker<T extends { lat: number; lng: number }>(
  points: T[],
  epsilonMeters = 3.0
): T[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIndex = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistanceM(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > epsilonMeters) {
    const left = douglasPeucker(points.slice(0, maxIndex + 1), epsilonMeters);
    const right = douglasPeucker(points.slice(maxIndex), epsilonMeters);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

export function simplifyPoints<T extends { lat: number; lng: number }>(
  points: T[],
  maxPoints = 800
): T[] {
  if (points.length <= maxPoints) return points;

  // 1. Aplica Douglas-Peucker com epsilon calibrado
  const rdp = douglasPeucker(points, 2.5);
  if (rdp.length <= maxPoints) {
    return rdp;
  }

  // 2. Se ainda exceder maxPoints após RDP, aplica sub-amostragem proporcional de segurança
  const step = Math.ceil(rdp.length / maxPoints);
  const simplified: T[] = [];
  for (let i = 0; i < rdp.length; i += step) {
    simplified.push(rdp[i]);
  }
  const last = rdp[rdp.length - 1];
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
