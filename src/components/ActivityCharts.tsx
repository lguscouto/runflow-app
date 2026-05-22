"use client";

import type { ActivityDetail } from "@/lib/types";
import {
  computeElevationSeries,
  computeHeartRateSeries,
  computePaceByKm,
  computePaceSeries,
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
  const paceByKm = computePaceByKm(activity);
  const paceSeries =
    paceByKm.length > 0
      ? paceByKm.map((p) => ({
          x: p.km,
          y: p.paceSecKm,
          label: `${p.km}`,
        }))
      : computePaceSeries(activity);

  const elevation = computeElevationSeries(activity);
  const heartRate = computeHeartRateSeries(activity);

  const hasPace = paceSeries.length >= 2;
  const hasElevation = elevation.length >= 2;
  const hasHr = heartRate.length >= 2;

  if (!hasPace && !hasElevation && !hasHr) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">{t("charts.title")}</h2>

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
