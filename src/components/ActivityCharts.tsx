"use client";

import { useMemo, useState } from "react";
import type { ActivityDetail } from "@/lib/types";
import {
  computeElevationSeries,
  computeHeartRateSeries,
  computePaceByKm,
  computePaceSeries,
  computeSpeedByKm,
  computeSpeedSeries,
  computePowerSeries,
  computeCadenceSeries,
  cumulativeDistances,
} from "@/lib/chart-data";
import { SimpleLineChart } from "./SimpleLineChart";
import { useI18n } from "@/lib/i18n";
import { Gauge, Zap, RefreshCw, Mountain, Heart, Activity } from "lucide-react";

function paceMinLabel(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.floor(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ActivityCharts({ activity }: { activity: ActivityDetail }) {
  const { t } = useI18n();
  const isCycling = activity.sport === "cycling";
  const [syncHoverX, setSyncHoverX] = useState<number | null>(null);

  const cumDist = useMemo(() => {
    return cumulativeDistances(activity.points);
  }, [activity.points]);

  // Pace series for running/walking
  const paceByKm = useMemo(
    () => (!isCycling ? computePaceByKm(activity, cumDist) : []),
    [activity, cumDist, isCycling]
  );
  const paceSeries = useMemo(() => {
    if (isCycling) return [];
    return paceByKm.length > 0
      ? paceByKm.map((p) => ({
          x: p.km,
          y: p.paceSecKm,
          label: `${p.km}`,
        }))
      : computePaceSeries(activity, 80, cumDist);
  }, [activity, paceByKm, cumDist, isCycling]);

  // Speed series for cycling
  const speedByKm = useMemo(
    () => (isCycling ? computeSpeedByKm(activity, cumDist) : []),
    [activity, cumDist, isCycling]
  );
  const speedSeries = useMemo(() => {
    if (!isCycling) return [];
    return speedByKm.length > 0
      ? speedByKm.map((p) => ({
          x: p.km,
          y: p.speedKmh,
          label: `${p.km}`,
        }))
      : computeSpeedSeries(activity, 120, cumDist);
  }, [activity, speedByKm, cumDist, isCycling]);

  // Power series for cycling
  const powerSeries = useMemo(
    () => (isCycling ? computePowerSeries(activity, 120, cumDist) : []),
    [activity, cumDist, isCycling]
  );

  // Cadence series for cycling or running
  const cadenceSeries = useMemo(
    () => computeCadenceSeries(activity, 120, cumDist),
    [activity, cumDist]
  );

  const elevation = useMemo(
    () => computeElevationSeries(activity, 120, cumDist),
    [activity, cumDist]
  );
  const heartRate = useMemo(
    () => computeHeartRateSeries(activity, 120, cumDist),
    [activity, cumDist]
  );

  const hasPace = !isCycling && paceSeries.length >= 2;
  const hasSpeed = isCycling && speedSeries.length >= 2;
  const hasPower = isCycling && powerSeries.length >= 2;
  const hasCadence = cadenceSeries.length >= 2;
  const hasElevation = elevation.length >= 2;
  const hasHr = heartRate.length >= 2;

  // Get current interpolated values at hovered X
  const currentHoverValues = useMemo(() => {
    if (syncHoverX == null) return null;
    const findClosest = (series: { x: number; y: number }[]) => {
      if (!series || series.length === 0) return null;
      let closest = series[0];
      let minD = Math.abs(series[0].x - syncHoverX);
      for (const pt of series) {
        const d = Math.abs(pt.x - syncHoverX);
        if (d < minD) {
          minD = d;
          closest = pt;
        }
      }
      return closest.y;
    };

    return {
      km: syncHoverX.toFixed(2),
      speed: hasSpeed ? findClosest(speedSeries) : null,
      pace: hasPace ? findClosest(paceSeries) : null,
      watts: hasPower ? findClosest(powerSeries) : null,
      cadence: hasCadence ? findClosest(cadenceSeries) : null,
      elevation: hasElevation ? findClosest(elevation) : null,
      hr: hasHr ? findClosest(heartRate) : null,
    };
  }, [
    syncHoverX,
    hasSpeed,
    speedSeries,
    hasPace,
    paceSeries,
    hasPower,
    powerSeries,
    hasCadence,
    cadenceSeries,
    hasElevation,
    elevation,
    hasHr,
    heartRate,
  ]);

  if (!hasPace && !hasSpeed && !hasPower && !hasCadence && !hasElevation && !hasHr) {
    return null;
  }

  return (
    <section className="space-y-4">
      {/* Header & Synchronized Telemetry HUD */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span>{t("charts.title")}</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 uppercase tracking-wider">
            Sincronizado
          </span>
        </h2>

        {/* Live Hover Telemetry Strip */}
        {currentHoverValues && (
          <div className="flex flex-wrap items-center gap-2 p-1.5 px-3 rounded-xl bg-black/60 border border-white/10 text-xs font-mono animate-fadeIn">
            <span className="text-amber-400 font-bold">km {currentHoverValues.km}:</span>
            {currentHoverValues.speed != null && (
              <span className="text-emerald-400 font-bold">
                {currentHoverValues.speed.toFixed(1)} km/h
              </span>
            )}
            {currentHoverValues.pace != null && (
              <span className="text-orange-400 font-bold">
                {paceMinLabel(currentHoverValues.pace)}/km
              </span>
            )}
            {currentHoverValues.watts != null && (
              <span className="text-amber-300 font-bold">
                {Math.round(currentHoverValues.watts)} W
              </span>
            )}
            {currentHoverValues.cadence != null && (
              <span className="text-cyan-300 font-bold">
                {Math.round(currentHoverValues.cadence)} RPM
              </span>
            )}
            {currentHoverValues.elevation != null && (
              <span className="text-blue-300">
                {Math.round(currentHoverValues.elevation)} m
              </span>
            )}
            {currentHoverValues.hr != null && (
              <span className="text-rose-400">
                {Math.round(currentHoverValues.hr)} bpm
              </span>
            )}
          </div>
        )}
      </div>

      {/* Running / Walking: Pace Chart */}
      {hasPace && (
        <div className="stat-card">
          <h3 className="text-sm font-medium text-[var(--muted)] mb-3 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff6b35] inline-block" />
            {paceByKm.length > 0 ? t("charts.pace_km") : t("charts.pace_time")}
          </h3>
          <SimpleLineChart
            data={paceSeries}
            color="#ff6b35"
            invertY
            formatY={paceMinLabel}
            xLabel={paceByKm.length > 0 ? t("charts.kilometer") : t("charts.distance_km")}
            hoverX={syncHoverX}
            onHoverX={setSyncHoverX}
          />
          <p className="text-xs text-[var(--muted)] mt-2 text-center">
            {t("charts.pace_tip")}
          </p>
        </div>
      )}

      {/* Cycling: Speed Chart */}
      {hasSpeed && (
        <div className="stat-card">
          <h3 className="text-sm font-medium text-[var(--muted)] mb-3 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
            {speedByKm.length > 0 ? t("charts.speed_km") : t("charts.speed_time")}
          </h3>
          <SimpleLineChart
            data={speedSeries}
            color="#10b981"
            formatY={(v) => `${v.toFixed(1)} km/h`}
            xLabel={speedByKm.length > 0 ? t("charts.kilometer") : t("charts.distance_km")}
            hoverX={syncHoverX}
            onHoverX={setSyncHoverX}
          />
        </div>
      )}

      {/* Cycling: Power Chart (Watts) */}
      {hasPower && (
        <div className="stat-card">
          <h3 className="text-sm font-medium text-[var(--muted)] mb-3 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            {t("charts.power_title")}
          </h3>
          <SimpleLineChart
            data={powerSeries}
            color="#f59e0b"
            formatY={(v) => `${Math.round(v)} W`}
            xLabel={t("charts.distance_km")}
            hoverX={syncHoverX}
            onHoverX={setSyncHoverX}
          />
          <p className="text-xs text-[var(--muted)] mt-2 text-center">
            {t("charts.power_watts")}
          </p>
        </div>
      )}

      {/* Cycling / Running: Cadence Chart (RPM) */}
      {hasCadence && (
        <div className="stat-card">
          <h3 className="text-sm font-medium text-[var(--muted)] mb-3 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
            {t("charts.cadence_title")}
          </h3>
          <SimpleLineChart
            data={cadenceSeries}
            color="#06b6d4"
            formatY={(v) => `${Math.round(v)} RPM`}
            xLabel={t("charts.distance_km")}
            hoverX={syncHoverX}
            onHoverX={setSyncHoverX}
          />
        </div>
      )}

      {/* Elevation Chart */}
      {hasElevation && (
        <div className="stat-card">
          <h3 className="text-sm font-medium text-[var(--muted)] mb-3 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />
            {t("charts.elevation")}
          </h3>
          <SimpleLineChart
            data={elevation}
            color="#60a5fa"
            formatY={(v) => `${Math.round(v)} m`}
            xLabel={t("charts.distance_km")}
            hoverX={syncHoverX}
            onHoverX={setSyncHoverX}
          />
        </div>
      )}

      {/* Heart Rate Chart */}
      {hasHr && (
        <div className="stat-card">
          <h3 className="text-sm font-medium text-[var(--muted)] mb-3 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" />
            {t("charts.hr")}
          </h3>
          <SimpleLineChart
            data={heartRate}
            color="#f87171"
            formatY={(v) => `${Math.round(v)}`}
            xLabel={t("charts.distance_km")}
            fillArea={false}
            hoverX={syncHoverX}
            onHoverX={setSyncHoverX}
          />
          <p className="text-xs text-[var(--muted)] mt-2 text-center">bpm</p>
        </div>
      )}

      {!hasHr && (
        <p className="text-xs text-[var(--muted)] text-center">
          {t("charts.hr_not_available")}
        </p>
      )}
    </section>
  );
}
