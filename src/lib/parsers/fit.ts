import FitParser from "fit-file-parser";
import type { ParsedActivity, Sport, TrackPoint } from "../types";
import { distanceFromPoints, elevationGainFromPoints } from "../geo";
import {
  normalizeCadence,
  normalizeCalories,
  normalizeElevation,
  normalizeHeartRate,
  normalizeNonNegative,
  normalizePower,
  normalizeSpeedKmh,
} from "./telemetry";

type FitRecord = Record<string, unknown>;

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function mapSport(sport?: string): Sport {
  const s = (sport ?? "").toLowerCase();
  if (s.includes("running") || s === "run") return "running";
  if (s.includes("walking") || s === "walk") return "walking";
  if (s.includes("cycling") || s.includes("bike")) return "cycling";
  return "running";
}

function fitTimestampToDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : undefined;
  }
  const ts = num(value);
  if (ts == null) return undefined;
  // FIT epoch: 31 Dec 1989 UTC
  const date = new Date((ts + 631065600) * 1000);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function toNodeBuffer(data: ArrayBuffer | Buffer): Buffer {
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) {
    return data;
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(data as ArrayBuffer);
  }
  return data as unknown as Buffer;
}

export function parseFit(
  buffer: ArrayBuffer | Buffer,
  fileName: string
): Promise<ParsedActivity> {
  return new Promise((resolve, reject) => {
    const parser = new FitParser({
      force: true,
      speedUnit: "km/h",
      lengthUnit: "m",
      temperatureUnit: "celsius",
      elapsedRecordField: true,
      mode: "both",
    });

    parser.parse(toNodeBuffer(buffer), (error: Error | null, data: FitRecord) => {
      if (error) {
        reject(new Error(`Erro ao ler FIT: ${error.message}`));
        return;
      }

      const records = (data.records as FitRecord[] | undefined) ?? [];
      const points: TrackPoint[] = [];

      for (const r of records) {
        const lat = num(r.position_lat ?? r.latitude);
        const lng = num(r.position_long ?? r.longitude);
        if (lat == null || lng == null) continue;

        const latDeg = Math.abs(lat) > 90 ? (lat * 180) / Math.pow(2, 31) : lat;
        const lngDeg = Math.abs(lng) > 180 ? (lng * 180) / Math.pow(2, 31) : lng;
        if (
          !Number.isFinite(latDeg) ||
          !Number.isFinite(lngDeg) ||
          latDeg < -90 ||
          latDeg > 90 ||
          lngDeg < -180 ||
          lngDeg > 180
        ) continue;

        const speedVal = num(r.enhanced_speed ?? r.speed);
        points.push({
          lat: latDeg,
          lng: lngDeg,
          elevation: normalizeElevation(num(r.altitude ?? r.enhanced_altitude)),
          timestamp: fitTimestampToDate(r.timestamp),
          hr: normalizeHeartRate(num(r.heart_rate)),
          watts: normalizePower(num(r.power)),
          cadence: normalizeCadence(num(r.cadence)),
          speedKmh: normalizeSpeedKmh(speedVal),
        });
      }

      if (points.length < 2) {
        reject(new Error("FIT sem coordenadas GPS suficientes."));
        return;
      }

      let previousTimestamp: Date | undefined;
      for (const point of points) {
        const current = point.timestamp;
        if (current && previousTimestamp && current.getTime() < previousTimestamp.getTime()) {
          reject(new Error("FIT com timestamps fora de ordem temporal."));
          return;
        }
        if (current) previousTimestamp = current;
      }

      const sessions = data.sessions as FitRecord[] | undefined;
      const session = sessions?.[0] ?? {};
      const activityMeta = (data.activity as FitRecord) ?? {};

      const startedAt =
        fitTimestampToDate(session.start_time) ??
        points.find((p) => p.timestamp)?.timestamp ??
        new Date();

      let durationSec =
        num(session.total_elapsed_time) ??
        num(session.total_timer_time) ??
        num(activityMeta.total_timer_time) ??
        0;

      if (!durationSec || durationSec <= 0) {
        const end = [...points].reverse().find((p) => p.timestamp)?.timestamp;
        if (end) {
          durationSec = Math.max(0, (end.getTime() - startedAt.getTime()) / 1000);
        }
      }

      let distanceM = num(session.total_distance) ?? 0;
      if (!distanceM || distanceM <= 0) {
        distanceM = distanceFromPoints(points);
      }

      const elevationGainM =
        normalizeNonNegative(num(session.total_ascent), 100_000) ?? elevationGainFromPoints(points);

      const avgHr = normalizeHeartRate(num(session.avg_heart_rate));
      const maxHr = normalizeHeartRate(num(session.max_heart_rate));

      let avgPaceSecKm: number | undefined;
      if (distanceM > 0 && durationSec > 0) {
        avgPaceSecKm = (durationSec / distanceM) * 1000;
      }

      const rawAvgSpeed = num(session.avg_speed ?? session.enhanced_avg_speed);
      const avgSpeedKmh = rawAvgSpeed != null
        ? normalizeSpeedKmh(rawAvgSpeed)
        : (distanceM > 0 && durationSec > 0 ? (distanceM / durationSec) * 3.6 : undefined);

      const rawMaxSpeed = num(session.max_speed ?? session.enhanced_max_speed);
      const maxSpeedKmh = rawMaxSpeed != null
        ? normalizeSpeedKmh(rawMaxSpeed)
        : undefined;

      const avgWatts = normalizePower(num(session.avg_power));
      const maxWatts = normalizePower(num(session.max_power));
      const normalizedPowerWatts = normalizePower(num(session.normalized_power));
      const avgCadenceRpm = normalizeCadence(num(session.avg_cadence));
      const maxCadenceRpm = normalizeCadence(num(session.max_cadence));

      const sport = mapSport(
        String(session.sport ?? session.sub_sport ?? "")
      );

      const calories = normalizeCalories(num(session.total_calories));

      resolve({
        name: fileName.replace(/\.fit$/i, ""),
        sport,
        startedAt,
        durationSec,
        distanceM,
        avgPaceSecKm,
        avgSpeedKmh: avgSpeedKmh != null ? Number(avgSpeedKmh.toFixed(1)) : undefined,
        maxSpeedKmh: maxSpeedKmh != null ? Number(maxSpeedKmh.toFixed(1)) : undefined,
        avgWatts,
        maxWatts,
        normalizedPowerWatts,
        avgCadenceRpm,
        maxCadenceRpm,
        calories,
        elevationGainM,
        avgHr: avgHr != null ? Math.round(avgHr) : undefined,
        maxHr: maxHr != null ? Math.round(maxHr) : undefined,
        points,
      });
    });
  });
}
