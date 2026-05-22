"use client";

import React from "react";
import type { TrackPoint } from "@/lib/types";
import { calculateSplits } from "@/lib/splits";
import { formatDuration, formatPace } from "@/lib/format";

interface ActivitySplitsProps {
  points: TrackPoint[];
}

export function ActivitySplits({ points }: ActivitySplitsProps) {
  const splits = calculateSplits(points);

  if (splits.length === 0) {
    return null;
  }

  const hasHr = splits.some((s) => s.avgHr != null);
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
    return `${integerPart + 1} (${meters}m)`;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Parciais por Km (Splits)</h2>
      <div className="stat-card overflow-x-auto p-0">
        <table className="w-full text-left border-collapse text-sm min-w-[500px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--muted)]">
              <th className="px-4 py-3 font-semibold w-24">Volta</th>
              <th className="px-4 py-3 font-semibold">Tempo</th>
              <th className="px-4 py-3 font-semibold">Ritmo</th>
              {hasElevation && (
                <th className="px-4 py-3 font-semibold">Ganho Elevação</th>
              )}
              {hasHr && (
                <th className="px-4 py-3 font-semibold">FC Média</th>
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
                  <td className="px-4 py-3">
                    {formatPace(split.paceSecKm)}
                  </td>
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
