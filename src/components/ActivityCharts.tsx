"use client";

import { useMemo } from "react";
import type { ActivityDetail } from "@/lib/types";
import {
  computeElevationSeries,
  computeHeartRateSeries,
  computePaceByKm,
  computePaceSeries,
  computeSpeedByKm,
  computeSpeedSeries,
  computePowerSeries,
  cumulativeDistances,
} from "@/lib/chart-data";
import { SimpleLineChart } from "./SimpleLineChart";
import { useI18n } from "@/lib/i18n";

function paceMinLabel(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.floor(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ActivityCharts({ activity }: { activity: ActivityDetail }) {
  const { t } = useI18n();
  const isCycling = activity.sport === "cycling";

  const cumDist = useMemo(() => {
    return cumulativeDistances(activity.points);
  }, [activity.points]);

  // Pace series for running/walking
  const paceByKm = useMemo(() => (!isCycling ? computePaceByKm(activity, cumDist) : []), [activity, cumDist, isCycling]);
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
  const speedByKm = useMemo(() => (isCycling ? computeSpeedByKm(activity, cumDist) : []), [activity, cumDist, isCycling]);
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
  const powerSeries = useMemo(() => (isCycling ? computePowerSeries(activity, 120, cumDist) : []), [activity, cumDist, isCycling]);

  const elevation = useMemo(() => computeElevationSeries(activity, 120, cumDist), [activity, cumDist]);
  const heartRate = useMemo(() => computeHeartRateSeries(activity, 120, cumDist), [activity, cumDist]);

  const hasPace = !isCycling && paceSeries.length >= 2;
  const hasSpeed = isCycling && speedSeries.length >= 2;
  const hasPower = isCycling && powerSeries.length >= 2;
  const hasElevation = elevation.length >= 2;
  const hasHr = heartRate.length >= 2;

  if (!hasPace && !hasSpeed && !hasPower && !hasElevation && !hasHr) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">{t("charts.title")}</h2>

      {/* Running / Walking: Pace Chart */}
      {hasPace && (
        <div className="stat-card">
          <h3 className="text-sm font-medium text-[var(--muted)] mb-3">
            {paceByKm.length > 0 ? t("charts.pace_km") : t("charts.pace_time")}
          </h3>
          <SimpleLineChart
            data={paceSeries}
            color="#ff6b35"
            invertY
            formatY={paceMinLabel}
            xLabel={paceByKm.length > 0 ? t("charts.kilometer") : t("charts.distance_km")}
          />
          <p className="text-xs text-[var(--muted)] mt-2 text-center">
            {t("charts.pace_tip")}
          </p>
        </div>
      )}

      {/* Cycling: Speed Chart */}
      {hasSpeed && (
        <div className="stat-card">
          <h3 className="text-sm font-medium text-[var(--muted)] mb-3">
            {speedByKm.length > 0 ? t("charts.speed_km") : t("charts.speed_time")}
          </h3>
          <SimpleLineChart
            data={speedSeries}
            color="#10b981"
            formatY={(v) => `${v.toFixed(1)} km/h`}
            xLabel={speedByKm.length > 0 ? t("charts.kilometer") : t("charts.distance_km")}
          />
        </div>
      )}

      {/* Cycling: Power Chart */}
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
          />
          <p className="text-xs text-[var(--muted)] mt-2 text-center">
            {t("charts.power_watts")}
          </p>
        </div>
      )}

      {hasElevation && (
        <div className="stat-card">
          <h3 className="text-sm font-medium text-[var(--muted)] mb-3">
            {t("charts.elevation")}
          </h3>
          <SimpleLineChart
            data={elevation}
            color="#60a5fa"
            formatY={(v) => `${Math.round(v)} m`}
            xLabel={t("charts.distance_km")}
          />
        </div>
      )}

      {hasHr && (
        <div className="stat-card">
          <h3 className="text-sm font-medium text-[var(--muted)] mb-3">
            {t("charts.hr")}
          </h3>
          <SimpleLineChart
            data={heartRate}
            color="#f87171"
            formatY={(v) => `${Math.round(v)}`}
            xLabel={t("charts.distance_km")}
            fillArea={false}
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
