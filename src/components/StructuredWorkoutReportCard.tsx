"use client";

import React from "react";
import {
  Flame,
  CheckCircle2,
  AlertCircle,
  Trophy,
  Target,
  Clock,
  Navigation,
  Gauge,
  Zap,
} from "lucide-react";
import type { StructuredWorkoutReport } from "@/lib/types";
import {
  getStepTypeBadgeStyle,
  formatStepTargetDescription,
  formatStepPaceRange,
} from "@/lib/structured-workout";
import { formatDistance, formatDuration, formatPace } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

interface StructuredWorkoutReportCardProps {
  report: StructuredWorkoutReport;
}

export function StructuredWorkoutReportCard({
  report,
}: StructuredWorkoutReportCardProps) {
  const { t, language } = useI18n();

  const { workoutName, completedSteps, totalSteps, complianceRatePercent, steps } =
    report;

  const isHighCompliance = complianceRatePercent >= 80;

  return (
    <div className="stat-card space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <Zap size={20} />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white leading-tight">
              {t("workout.report_title")}
            </h3>
            <p className="text-xs text-[var(--muted)]">
              {workoutName} • {completedSteps} / {totalSteps} etapas concluídas
            </p>
          </div>
        </div>

        {/* Compliance Rate Badge */}
        <div
          className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold ${
            isHighCompliance
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
              : "bg-amber-500/15 border-amber-500/30 text-amber-400"
          }`}
        >
          {isHighCompliance ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>
            {complianceRatePercent}% {t("workout.compliance_rate")}
          </span>
        </div>
      </div>

      {/* Steps Table / List */}
      <div className="space-y-2">
        <div className="grid grid-cols-12 text-[11px] font-bold text-[var(--muted)] px-3 pb-1 border-b border-white/5 uppercase tracking-wider">
          <div className="col-span-4 sm:col-span-3">Etapa</div>
          <div className="col-span-3 sm:col-span-3">Meta</div>
          <div className="col-span-3 sm:col-span-3">Executado</div>
          <div className="col-span-2 sm:col-span-3 text-right">Resultado</div>
        </div>

        {steps.map((step, idx) => {
          const badge = getStepTypeBadgeStyle(step.type);
          const paceTargetStr = formatStepPaceRange(step.paceTarget);

          return (
            <div
              key={idx}
              className="grid grid-cols-12 items-center gap-1 p-2.5 sm:p-3 rounded-xl bg-[#161b22]/70 border border-[var(--border)] text-xs hover:border-white/20 transition-all"
            >
              {/* Step Type & Name */}
              <div className="col-span-4 sm:col-span-3 flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${badge.dotColor}`}
                />
                <span className="font-semibold text-white truncate">
                  {step.repeatIndex && step.totalRepeats
                    ? `${step.type === "work" ? "Tiro" : "Recup."} ${step.repeatIndex}/${step.totalRepeats}`
                    : step.name || badge.namePt}
                </span>
              </div>

              {/* Programmed Target */}
              <div className="col-span-3 sm:col-span-3 text-[var(--muted)] space-y-0.5">
                <div className="font-mono text-white">
                  {formatStepTargetDescription(step.targetType, step.targetValue, language)}
                </div>
                {paceTargetStr && (
                  <div className="text-[10px] text-orange-400 font-mono">
                    {paceTargetStr}
                  </div>
                )}
              </div>

              {/* Executed Stats */}
              <div className="col-span-3 sm:col-span-3 space-y-0.5">
                <div className="font-mono font-bold text-white">
                  {formatDistance(step.distanceM)} • {formatDuration(step.durationSec)}
                </div>
                {step.avgPaceSecKm && (
                  <div className="text-[10px] text-[var(--muted)] font-mono">
                    {formatPace(step.avgPaceSecKm)}
                  </div>
                )}
              </div>

              {/* Compliance Badge */}
              <div className="col-span-2 sm:col-span-3 text-right">
                {step.targetMet ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                    <CheckCircle2 size={12} className="hidden sm:inline" />
                    <span>OK</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400">
                    <AlertCircle size={12} className="hidden sm:inline" />
                    <span>Abaixo</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}