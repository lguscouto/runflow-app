"use client";

import React, { useState } from "react";
import { Activity, Flame, HeartPulse, Info, Sparkles, Award } from "lucide-react";
import type { VO2MaxEstimate } from "@/lib/types";
import { classifyVO2Max } from "@/lib/vo2max";
import { useI18n } from "@/lib/i18n";

interface VO2MaxFitnessCardProps {
  estimate: VO2MaxEstimate;
}

export function VO2MaxFitnessCard({ estimate }: VO2MaxFitnessCardProps) {
  const { t } = useI18n();
  const [showInfo, setShowInfo] = useState(false);

  const classification = classifyVO2Max(
    estimate.vo2Max,
    estimate.chronologicalAge || 30
  );

  const categoryLabel = t(classification.labelKey);

  // Diferença de idade biológica vs cronológica
  const ageDiff = estimate.chronologicalAge
    ? estimate.chronologicalAge - estimate.fitnessAge
    : null;

  // Cálculo da posição no medidor (escala 20 a 70 ml/kg/min)
  const minScale = 25;
  const maxScale = 65;
  const clampedVo2 = Math.max(minScale, Math.min(maxScale, estimate.vo2Max));
  const percentPosition = Math.round(
    ((clampedVo2 - minScale) / (maxScale - minScale)) * 100
  );

  const methodLabel =
    estimate.method === "heart_rate_running"
      ? t("vo2max.method_hr_running")
      : estimate.method === "hr_ratio"
      ? t("vo2max.method_hr_ratio")
      : estimate.method === "vdot_performance"
      ? t("vo2max.method_vdot")
      : t("vo2max.method_estimated");

  const confidenceLabel =
    estimate.confidence === "high"
      ? t("vo2max.confidence_high")
      : estimate.confidence === "medium"
      ? t("vo2max.confidence_medium")
      : t("vo2max.confidence_low");

  return (
    <div className="stat-card relative overflow-hidden bg-gradient-to-br from-[#121824] via-[#10141d] to-[#0b0e14] border border-[var(--border)] rounded-2xl p-5 md:p-6 shadow-xl">
      {/* Background glowing ambient light */}
      <div
        className="absolute -top-12 -right-12 w-44 h-44 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ backgroundColor: classification.color }}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md"
            style={{ backgroundColor: classification.color }}
          >
            <Activity size={22} className="stroke-[2.5]" />
          </span>
          <div>
            <h3 className="font-bold text-lg text-white leading-tight flex items-center gap-1.5">
              {t("vo2max.title")}
            </h3>
            <p className="text-xs text-[var(--muted)]">{t("vo2max.subtitle")}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowInfo(!showInfo)}
          className="p-1.5 rounded-lg text-[var(--muted)] hover:text-white hover:bg-white/10 transition-colors"
          title="O que é VO2 Max?"
        >
          <Info size={18} />
        </button>
      </div>

      {showInfo && (
        <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-[var(--muted)] animate-fadeIn">
          <p className="leading-relaxed">{t("vo2max.what_is_it")}</p>
        </div>
      )}

      {/* Main Metric & Fitness Badge */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-black/30 border border-white/5 rounded-xl p-4 mb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            VO2 Max Estimado
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-4xl font-extrabold tracking-tight text-white font-mono">
              {estimate.vo2Max.toFixed(1)}
            </span>
            <span className="text-sm font-medium text-[var(--muted)]">
              {t("vo2max.unit")}
            </span>
          </div>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold"
               style={{ backgroundColor: classification.bgRgba, color: classification.color }}>
            <Award size={13} />
            {categoryLabel}
          </div>
        </div>

        {/* Idade de Condicionamento */}
        <div className="sm:border-l sm:border-white/10 sm:pl-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
            <Sparkles size={13} className="text-amber-400" />
            {t("vo2max.fitness_age_title")}
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-extrabold text-amber-400 font-mono">
              {t("vo2max.fitness_age_years", { age: estimate.fitnessAge })}
            </span>
          </div>
          <p className="text-xs text-[var(--muted)] mt-1">
            {ageDiff !== null && ageDiff > 0 ? (
              <span className="text-emerald-400 font-medium">
                ⚡ {t("vo2max.younger_than_real", { diff: ageDiff })}
              </span>
            ) : ageDiff !== null && ageDiff < 0 ? (
              <span className="text-amber-400 font-medium">
                {t("vo2max.older_than_real", { diff: Math.abs(ageDiff) })}
              </span>
            ) : (
              <span>{t("vo2max.same_as_real")}</span>
            )}
          </p>
        </div>
      </div>

      {/* Visual Level Spectrum Gauge */}
      <div className="space-y-1.5 mb-4">
        <div className="flex justify-between text-[10px] text-[var(--muted)] font-medium px-0.5">
          <span>Iniciante (30)</span>
          <span>Razoável (38)</span>
          <span>Bom (45)</span>
          <span>Excelente (52)</span>
          <span>Superior (60+)</span>
        </div>
        <div className="relative h-2.5 w-full bg-white/10 rounded-full overflow-hidden">
          {/* Gradient bar */}
          <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-amber-500 via-sky-500 via-emerald-500 to-purple-500 rounded-full opacity-80" />
        </div>
        {/* Indicator marker */}
        <div className="relative h-2 w-full">
          <div
            className="absolute -top-3 -ml-2 flex flex-col items-center transition-all duration-500"
            style={{ left: `${percentPosition}%` }}
          >
            <div className="w-4 h-4 rounded-full border-2 border-white bg-slate-900 shadow-md flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: classification.color }} />
            </div>
          </div>
        </div>
      </div>

      {/* Method and Confidence Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5 text-[11px] text-[var(--muted)]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: classification.color }} />
          <span>{methodLabel}</span>
          {estimate.sampleCount > 0 && (
            <span>• {t("vo2max.samples_count", { count: estimate.sampleCount })}</span>
          )}
        </div>
        <span className="bg-white/5 px-2 py-0.5 rounded text-[10px] font-medium text-slate-300">
          {confidenceLabel}
        </span>
      </div>
    </div>
  );
}
