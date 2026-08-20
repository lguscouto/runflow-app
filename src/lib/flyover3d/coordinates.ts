import type { TrackPoint } from "../types";

export interface Normalized3DPoint {
  x: number;
  y: number; // Altura (Cima no Three.js)
  z: number;
  distanceM: number;
  elapsedSec: number;
  paceSecKm: number;
  elevationM: number;
  hr?: number;
  color: [number, number, number]; // [r, g, b] normalizados (0-1)
  original: TrackPoint;
}

export interface Track3DData {
  points: Normalized3DPoint[];
  totalDistanceM: number;
  totalDurationSec: number;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
    sizeX: number;
    sizeY: number;
    sizeZ: number;
  };
  minElevationM: number;
  maxElevationM: number;
  avgElevationM: number;
}

const R_EARTH = 6378137; // Raio da Terra em metros (WGS84)

/**
 * Converte graus em radianos
 */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Calcula a distância Haversine em metros entre dois pontos geográficos
 */
function haversineDistM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R_EARTH * c;
}

/**
 * Converte um ritmo (s/km) em uma cor RGB com gradiente suave:
 * Verde (rápido) -> Amarelo (médio) -> Laranja/Vermelho (lento/subida íngreme)
 */
function paceToRgb(paceSecKm: number, minPace: number, maxPace: number): [number, number, number] {
  if (isNaN(paceSecKm) || paceSecKm <= 0) {
    return [0.06, 0.72, 0.5]; // Verde padrão
  }

  // Normaliza o ritmo entre 0 (mais rápido) e 1 (mais lento)
  const range = Math.max(1, maxPace - minPace);
  const t = Math.max(0, Math.min(1, (paceSecKm - minPace) / range));

  if (t < 0.5) {
    // Verde -> Amarelo
    const k = t / 0.5;
    return [
      0.06 + k * (0.96 - 0.06), // R
      0.72 + k * (0.62 - 0.72), // G
      0.5 - k * 0.46,          // B
    ];
  } else {
    // Amarelo -> Vermelho
    const k = (t - 0.5) / 0.5;
    return [
      0.96 + k * (0.94 - 0.96), // R
      0.62 - k * (0.62 - 0.27), // G
      0.04 + k * (0.27 - 0.04), // B
    ];
  }
}

/**
 * Processa a lista bruta de TrackPoints e gera dados tridimensionais normalizados para o Three.js
 */
export function processTrackPoints3D(rawPoints: TrackPoint[]): Track3DData | null {
  if (!rawPoints || rawPoints.length < 2) return null;

  // 1. Filtra pontos válidos
  const points = rawPoints.filter(
    (p) => typeof p.lat === "number" && typeof p.lng === "number" && !isNaN(p.lat) && !isNaN(p.lng)
  );

  if (points.length < 2) return null;

  // 2. Calcula centro e limites geográficos
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  let minEle = Infinity, maxEle = -Infinity;
  let hasElevation = false;

  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
    if (typeof p.elevation === "number" && !isNaN(p.elevation)) {
      hasElevation = true;
      if (p.elevation < minEle) minEle = p.elevation;
      if (p.elevation > maxEle) maxEle = p.elevation;
    }
  }

  if (!hasElevation || minEle === Infinity) {
    minEle = 0;
    maxEle = 0;
  }

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  const cosCenterLat = Math.cos(toRad(centerLat));

  // 3. Converte para coordenadas métricas em relação ao centro
  const metricPoints: Array<{
    mx: number;
    my: number;
    mz: number;
    distM: number;
    elapsedSec: number;
    paceSecKm: number;
    elevationM: number;
    original: TrackPoint;
  }> = [];

  let cumDist = 0;
  const startTime = points[0].timestamp ? new Date(points[0].timestamp).getTime() : 0;
  let prevTime = startTime;
  let prevDist = 0;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const mx = toRad(p.lng - centerLng) * R_EARTH * cosCenterLat;
    const mz = -toRad(p.lat - centerLat) * R_EARTH; // -Z é Norte
    const ele = p.elevation ?? minEle;
    const my = ele - minEle;

    if (i > 0) {
      const prev = points[i - 1];
      const d = haversineDistM(prev.lat, prev.lng, p.lat, p.lng);
      cumDist += d;
    }

    const curTime = p.timestamp ? new Date(p.timestamp).getTime() : startTime + i * 1000;
    const elapsedSec = (curTime - startTime) / 1000;

    // Ritmo instantâneo nos últimos metros/segundos
    let paceSecKm = 330; // 5:30 min/km padrão
    const dt = (curTime - prevTime) / 1000;
    const dd = cumDist - prevDist;
    if (dt >= 2 && dd > 5) {
      const speedMs = dd / dt;
      if (speedMs > 0.5 && speedMs < 12) {
        paceSecKm = 1000 / speedMs;
      }
      prevTime = curTime;
      prevDist = cumDist;
    }

    metricPoints.push({
      mx,
      my,
      mz,
      distM: cumDist,
      elapsedSec,
      paceSecKm,
      elevationM: ele,
      original: p,
    });
  }

  // 4. Determina ritmo mínimo e máximo para o gradiente de cores
  const validPaces = metricPoints.map((p) => p.paceSecKm).filter((p) => p > 120 && p < 900);
  validPaces.sort((a, b) => a - b);
  const p10 = validPaces[Math.floor(validPaces.length * 0.1)] || 240; // 4:00 min/km
  const p90 = validPaces[Math.floor(validPaces.length * 0.9)] || 420; // 7:00 min/km

  // 5. Normaliza para o espaço 3D (Cena com extensão aproximada de 100 unidades no plano XZ)
  let maxBoundXZ = 0;
  for (const p of metricPoints) {
    if (Math.abs(p.mx) > maxBoundXZ) maxBoundXZ = Math.abs(p.mx);
    if (Math.abs(p.mz) > maxBoundXZ) maxBoundXZ = Math.abs(p.mz);
  }
  const scaleXZ = maxBoundXZ > 0 ? 50 / maxBoundXZ : 1;

  // Exagero vertical da elevação para visualização nítida
  const eleDelta = maxEle - minEle;
  let scaleY = scaleXZ;
  if (eleDelta > 0) {
    // Garante que relevos fiquem visíveis proporcionalmente
    scaleY = Math.max(scaleXZ * 1.5, 15 / eleDelta);
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  const normalizedPoints: Normalized3DPoint[] = metricPoints.map((p) => {
    const x = p.mx * scaleXZ;
    const y = p.my * scaleY;
    const z = p.mz * scaleXZ;

    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;

    return {
      x,
      y,
      z,
      distanceM: p.distM,
      elapsedSec: p.elapsedSec,
      paceSecKm: p.paceSecKm,
      elevationM: p.elevationM,
      hr: p.original.hr,
      color: paceToRgb(p.paceSecKm, p10, p90),
      original: p.original,
    };
  });

  return {
    points: normalizedPoints,
    totalDistanceM: cumDist,
    totalDurationSec: metricPoints[metricPoints.length - 1]?.elapsedSec || 0,
    bounds: {
      minX,
      maxX,
      minY,
      maxY,
      minZ,
      maxZ,
      sizeX: maxX - minX,
      sizeY: maxY - minY,
      sizeZ: maxZ - minZ,
    },
    minElevationM: minEle,
    maxElevationM: maxEle,
    avgElevationM: (minEle + maxEle) / 2,
  };
}
