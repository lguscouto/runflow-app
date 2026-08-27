"use client";

import React from "react";
import type { Sport, TrackPoint } from "@/lib/types";
import { calculateSplits } from "@/lib/splits";
import { formatDuration, formatPace, formatSpeed, formatWatts } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

interface ActivitySplitsProps {
  points: TrackPoint[];
  sport?: Sport;
}

export function ActivitySplits({ points, sport = "running" }: ActivitySplitsProps) {
  const { t } = useI18n();
  const splits = calculateSplits(points);

  if (splits.length === 0) {
    return null;
  }

  const isCycling = sport === "cycling";
  const hasHr = splits.some((s) => s.avgHr != null);
  const hasWatts = isCycling && splits.some((s) => s.avgWatts != null && s.avgWatts > 0);
  const hasElevation = splits.some((s) => s.elevationGainM > 0.5);

  function formatSplitIndex(km: number): string {
    if (Number.isInteger(km)) {
      return String(km);
    }
    const integerPart = Math.floor(km);
    const fraction = km - integerPart;
    const meters = Math.round(fraction * 1000);
    if (integerPart === 0) {
      return `${meters}m`;
    }
    return `${t("splits.final")} (${meters}m)`;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">{t("splits.title")}</h2>
      <div className="stat-card overflow-x-auto p-0">
        <table className="w-full text-left border-collapse text-sm min-w-[500px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--muted)]">
              <th className="px-4 py-3 font-semibold w-24">{t("splits.lap")}</th>
              <th className="px-4 py-3 font-semibold">{t("record.time")}</th>
              <th className="px-4 py-3 font-semibold">
                {isCycling ? t("splits.speed") : t("splits.pace")}
              </th>
              {hasWatts && (
                <th className="px-4 py-3 font-semibold text-[var(--color-status-warning)]">
                  {t("splits.watts")}
                </th>
              )}
              {hasElevation && (
                <th className="px-4 py-3 font-semibold">{t("splits.elevation")}</th>
              )}
              {hasHr && (
                <th className="px-4 py-3 font-semibold">{t("splits.hr")}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {splits.map((split, idx) => {
              const isFractional = !Number.isInteger(split.km);
              return (
                <tr
                  key={idx}
                  className={`border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-hover)] transition-colors ${
                    isFractional
                      ? "text-[var(--muted)] italic bg-[var(--surface-hover)]/20"
                      : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium">
                    {formatSplitIndex(split.km)}
                  </td>
                  <td className="px-4 py-3">
                    {formatDuration(split.durationSec)}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {isCycling
                      ? formatSpeed(
                          split.speedKmh ??
                            (split.paceSecKm ? 3600 / split.paceSecKm : null)
                        )
                      : formatPace(split.paceSecKm)}
                  </td>
                  {hasWatts && (
                    <td className="px-4 py-3 font-medium text-[var(--color-status-warning)]">
                      {formatWatts(split.avgWatts)}
                    </td>
                  )}
                  {hasElevation && (
                    <td className="px-4 py-3">
                      {split.elevationGainM > 0.5
                        ? `+${Math.round(split.elevationGainM)} m`
                        : "—"}
                    </td>
                  )}
                  {hasHr && (
                    <td className="px-4 py-3">
                      {split.avgHr ? `${split.avgHr} bpm` : "—"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
