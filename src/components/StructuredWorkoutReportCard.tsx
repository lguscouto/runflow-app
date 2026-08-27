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
  RefreshCw,
} from "lucide-react";
import type { StructuredWorkoutReport } from "@/lib/types";
import {
  getStepTypeBadgeStyle,
  formatStepTargetDescription,
  formatStepPaceRange,
  formatStepCadenceRange,
} from "@/lib/structured-workout";
import { formatDistance, formatDuration, formatPace, formatWatts } from "@/lib/format";
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
          <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-[var(--color-status-warning)]">
            <Zap size={20} />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[var(--text)] leading-tight">
              {t("workout.report_title")}
            </h3>
            <p className="text-xs text-[var(--muted)]">
              {workoutName} • {t("workout.steps_completed", { completed: completedSteps, total: totalSteps })}
            </p>
          </div>
        </div>

        {/* Compliance Rate Badge */}
        <div
          className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold ${
            isHighCompliance
              ? "bg-emerald-500/15 border-emerald-500/30 text-[var(--color-status-positive)]"
              : "bg-amber-500/15 border-amber-500/30 text-[var(--color-status-warning)]"
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
        <div className="grid grid-cols-12 text-[11px] font-bold text-[var(--muted)] px-3 pb-1 border-b border-[var(--border)] uppercase tracking-wider">
          <div className="col-span-4 sm:col-span-3">{t("workout.report_step")}</div>
          <div className="col-span-3 sm:col-span-3">{t("workout.report_target")}</div>
          <div className="col-span-3 sm:col-span-4">{t("workout.report_executed")}</div>
          <div className="col-span-2 sm:col-span-2 text-right">{t("workout.report_result")}</div>
        </div>

        {steps.map((step, idx) => {
          const badge = getStepTypeBadgeStyle(step.type);
          const paceTargetStr = formatStepPaceRange(step.paceTarget);
          const cadenceTargetStr = formatStepCadenceRange(step.cadenceTarget);

          // Power Target text
          let powerTargetStr = "";
          if (step.powerTarget) {
            const { minWatts, maxWatts, targetWatts } = step.powerTarget;
            if (minWatts && maxWatts) powerTargetStr = `${minWatts}-${maxWatts} W`;
            else if (targetWatts) powerTargetStr = `${targetWatts} W`;
            else if (minWatts) powerTargetStr = `≥ ${minWatts} W`;
          } else if (step.powerZoneTarget) {
            powerTargetStr = `Z${step.powerZoneTarget}`;
          }

          return (
            <div
              key={idx}
              className="grid grid-cols-12 items-center gap-1 p-2.5 sm:p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text)] hover:border-[var(--border-strong)] transition-all"
            >
              {/* Step Type & Name */}
              <div className="col-span-4 sm:col-span-3 flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${badge.dotColor}`}
                />
                <span className="font-semibold text-[var(--text)] truncate">
                  {step.repeatIndex && step.totalRepeats
                    ? `${t(step.type === "work" ? "workout.repeat_work" : "workout.repeat_recovery")} ${step.repeatIndex}/${step.totalRepeats}`
                    : step.name || t(language === "en" ? "workout.step_" + step.type : "workout.step_" + step.type)}
                </span>
              </div>

              {/* Programmed Target */}
              <div className="col-span-3 sm:col-span-3 text-[var(--muted)] space-y-0.5">
                <div className="font-mono text-[var(--text)]">
                  {formatStepTargetDescription(step.targetType, step.targetValue, language)}
                </div>
                {paceTargetStr && (
                  <div className="text-[10px] text-[var(--color-chart-pace)] font-mono">
                    {paceTargetStr}
                  </div>
                )}
                {powerTargetStr && (
                  <div className="text-[10px] text-[var(--color-status-warning)] font-mono flex items-center gap-1">
                    <Zap size={10} className="fill-amber-400" />
                    <span>{powerTargetStr}</span>
                  </div>
                )}
                {cadenceTargetStr && (
                  <div className="text-[10px] text-[var(--color-chart-cadence)] font-mono flex items-center gap-1">
                    <RefreshCw size={10} />
                    <span>{cadenceTargetStr}</span>
                  </div>
                )}
              </div>

              {/* Executed Stats */}
              <div className="col-span-3 sm:col-span-4 space-y-0.5">
                <div className="font-mono font-bold text-[var(--text)]">
                  {formatDistance(step.distanceM)} • {formatDuration(step.durationSec)}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--muted)] font-mono">
                  {step.avgPaceSecKm && <span>{formatPace(step.avgPaceSecKm)}</span>}
                  {step.avgWatts !== undefined && step.avgWatts !== null && step.avgWatts > 0 && (
                    <span className="text-[var(--color-status-warning)] font-bold">{formatWatts(step.avgWatts)}</span>
                  )}
                  {step.avgCadenceRpm !== undefined && step.avgCadenceRpm !== null && step.avgCadenceRpm > 0 && (
                    <span className="text-[var(--color-chart-cadence)]">{step.avgCadenceRpm} RPM</span>
                  )}
                  {step.avgHr && <span className="text-[var(--color-chart-heart-rate)]">{step.avgHr} bpm</span>}
                </div>
              </div>

              {/* Compliance Badge */}
              <div className="col-span-2 sm:col-span-2 text-right">
                {step.targetMet ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-[var(--color-status-positive)]">
                    <CheckCircle2 size={12} className="hidden sm:inline" />
                    <span>{t("workout.result_ok")}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-[var(--color-status-warning)]">
                    <AlertCircle size={12} className="hidden sm:inline" />
                    <span>{t("workout.result_below")}</span>
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