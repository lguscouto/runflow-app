"use client";

import React from "react";
import { Timer, Trophy, Flag, Sparkles, TrendingUp } from "lucide-react";
import type { RacePrediction } from "@/lib/types";
import { formatPace } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { colorTokens } from "@/lib/color-tokens";

interface RacePredictorCardProps {
  predictions: RacePrediction[];
}

function formatPredictedTime(totalSec: number): string {
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = Math.floor(totalSec % 60);

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds
      .toString()
      .padStart(2, "0")}s`;
  }
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export function RacePredictorCard({ predictions }: RacePredictorCardProps) {
  const { t } = useI18n();

  if (!predictions || predictions.length === 0) return null;

  const baseDistKm = predictions[0]?.baseDistanceM
    ? (predictions[0].baseDistanceM / 1000).toFixed(1)
    : null;

  // Gradientes e ícones específicos para cada distância
  const distanceConfigs: Record<
    string,
    { badgeColor: string; bgSoft: string; iconBg: string }
  > = {
    "5k": {
      badgeColor: colorTokens.race.fiveK.color,
      bgSoft: colorTokens.race.fiveK.background,
      iconBg: "bg-emerald-500/20 text-emerald-400",
    },
    "10k": {
      badgeColor: colorTokens.race.tenK.color,
      bgSoft: colorTokens.race.tenK.background,
      iconBg: "bg-sky-500/20 text-sky-400",
    },
    half_marathon: {
      badgeColor: colorTokens.race.halfMarathon.color,
      bgSoft: colorTokens.race.halfMarathon.background,
      iconBg: "bg-purple-500/20 text-purple-400",
    },
    marathon: {
      badgeColor: colorTokens.race.marathon.color,
      bgSoft: colorTokens.race.marathon.background,
      iconBg: "bg-orange-500/20 text-orange-400",
    },
  };

  return (
    <div className="stat-card bg-gradient-to-br from-[var(--color-surface-race-start)] via-[var(--color-surface-race-middle)] to-[var(--color-surface-race-end)] border border-[var(--border)] rounded-2xl p-5 md:p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center text-white shrink-0 shadow-md">
            <Trophy size={22} className="stroke-[2.5]" />
          </span>
          <div>
            <h3 className="font-bold text-lg text-white leading-tight flex items-center gap-1.5">
              {t("race_predictor.title")}
            </h3>
            <p className="text-xs text-[var(--muted)]">{t("race_predictor.subtitle")}</p>
          </div>
        </div>

        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
          <Sparkles size={12} />
          Fórmula Riegel
        </span>
      </div>

      {/* Grid das 4 Distâncias */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {predictions.map((pred) => {
          const config = distanceConfigs[pred.id] || {
            badgeColor: colorTokens.race.fallback.color,
            bgSoft: colorTokens.race.fallback.background,
            iconBg: "bg-[var(--accent)]/20 text-[var(--accent)]",
          };

          return (
            <div
              key={pred.id}
              className="relative overflow-hidden rounded-xl border border-white/5 p-3.5 transition-all hover:border-white/15"
              style={{ backgroundColor: config.bgSoft }}
            >
              {/* Distance Tag */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  {t(pred.nameKey)}
                </span>
                <span
                  className="w-2 h-2 rounded-full shadow-sm"
                  style={{ backgroundColor: config.badgeColor }}
                />
              </div>

              {/* Tempo Previsto */}
              <div className="mb-2">
                <span className="text-[10px] text-[var(--muted)] block font-medium">
                  {t("race_predictor.estimated_time")}
                </span>
                <span className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
                  {formatPredictedTime(pred.predictedTimeSec)}
                </span>
              </div>

              {/* Ritmo Alvo */}
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                <span className="text-[11px] text-[var(--muted)]">
                  {t("race_predictor.target_pace")}
                </span>
                <span className="font-bold text-slate-200 font-mono">
                  {formatPace(pred.targetPaceSecKm)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5 text-[11px] text-[var(--muted)]">
        <div className="flex items-center gap-1.5">
          <TrendingUp size={13} className="text-emerald-400" />
          {baseDistKm ? (
            <span>{t("race_predictor.based_on", { dist: baseDistKm })}</span>
          ) : (
            <span>{t("race_predictor.formula_note")}</span>
          )}
        </div>
        <span className="text-[10px] text-slate-400 font-mono">
          5K · 10K · 21.1K · 42.2K
        </span>
      </div>
    </div>
  );
}
