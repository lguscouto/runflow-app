"use client";

import React from "react";
import {
  Flame,
  SkipForward,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Gauge,
  Sparkles,
  Zap,
  RefreshCw,
} from "lucide-react";
import type { FlatWorkoutStep, Sport, WorkoutPaceTarget } from "@/lib/types";
import {
  getStepTypeBadgeStyle,
  formatStepTargetDescription,
  formatStepPaceRange,
  resolveStepPowerTargetWatts,
  formatStepCadenceRange,
} from "@/lib/structured-workout";
import { formatDistance, formatDuration, formatPace, formatWatts } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { DEFAULT_FTP_WATTS } from "@/lib/power-zones";

export interface StructuredWorkoutHudProps {
  currentStep: FlatWorkoutStep;
  nextStep: FlatWorkoutStep | null;
  workoutName: string;
  stepElapsedSec: number;
  stepDistanceM: number;
  currentPaceSecKm: number | null;
  currentWatts?: number | null;
  currentCadenceRpm?: number | null;
  userFtp?: number;
  sport?: Sport;
  onSkipStep: () => void;
}

export function StructuredWorkoutHud({
  currentStep,
  nextStep,
  workoutName,
  stepElapsedSec,
  stepDistanceM,
  currentPaceSecKm,
  currentWatts,
  currentCadenceRpm,
  userFtp = DEFAULT_FTP_WATTS,
  sport = "running",
  onSkipStep,
}: StructuredWorkoutHudProps) {
  const { t, language } = useI18n();

  const { step, stepIndex, totalSteps, repeatIndex, totalRepeats } = currentStep;
  const badge = getStepTypeBadgeStyle(step.type);

  // Calculate Progress & Remaining
  let progressPercent = 0;
  let remainingText = "";

  if (step.targetType === "distance") {
    const targetM = step.targetValue;
    progressPercent = Math.min(100, (stepDistanceM / targetM) * 100);
    const remM = Math.max(0, targetM - stepDistanceM);
    remainingText = `${formatDistance(remM)} ${t("workout.remaining")}`;
  } else if (step.targetType === "time") {
    const targetSec = step.targetValue;
    progressPercent = Math.min(100, (stepElapsedSec / targetSec) * 100);
    const remSec = Math.max(0, targetSec - stepElapsedSec);
    remainingText = `${formatDuration(remSec)} ${t("workout.remaining")}`;
  } else {
    // Open target
    progressPercent = 100;
    remainingText = formatDistance(stepDistanceM);
  }

  // Pace Target Evaluation (Running)
  let paceStatus: "on_target" | "too_slow" | "too_fast" | null = null;
  if (step.paceTarget && currentPaceSecKm && currentPaceSecKm > 0) {
    const { minPaceSecKm, maxPaceSecKm } = step.paceTarget;
    if (minPaceSecKm && currentPaceSecKm < minPaceSecKm - 5) {
      paceStatus = "too_fast";
    } else if (maxPaceSecKm && currentPaceSecKm > maxPaceSecKm + 5) {
      paceStatus = "too_slow";
    } else {
      paceStatus = "on_target";
    }
  }

  // Power Target Evaluation (Cycling)
  const resolvedPower = resolveStepPowerTargetWatts(step, userFtp);
  let powerStatus: "on_target" | "too_low" | "too_high" | null = null;
  if (resolvedPower && currentWatts !== undefined && currentWatts !== null && currentWatts > 0) {
    const { minWatts, maxWatts } = resolvedPower;
    if (currentWatts < minWatts * 0.9) {
      powerStatus = "too_low";
    } else if (maxWatts < 9000 && currentWatts > maxWatts * 1.1) {
      powerStatus = "too_high";
    } else {
      powerStatus = "on_target";
    }
  }

  // Cadence Target Evaluation (Cycling / Running)
  let cadenceStatus: "on_target" | "too_low" | "too_high" | null = null;
  if (step.cadenceTarget && currentCadenceRpm !== undefined && currentCadenceRpm !== null && currentCadenceRpm > 0) {
    const { minCadenceRpm, maxCadenceRpm, targetCadenceRpm } = step.cadenceTarget;
    const min = minCadenceRpm || (targetCadenceRpm ? targetCadenceRpm - 5 : undefined);
    const max = maxCadenceRpm || (targetCadenceRpm ? targetCadenceRpm + 5 : undefined);
    if (min && currentCadenceRpm < min) {
      cadenceStatus = "too_low";
    } else if (max && currentCadenceRpm > max) {
      cadenceStatus = "too_high";
    } else {
      cadenceStatus = "on_target";
    }
  }

  const paceRangeStr = formatStepPaceRange(step.paceTarget);
  const cadenceRangeStr = formatStepCadenceRange(step.cadenceTarget);

  return (
    <div className="w-full rounded-2xl bg-[#0f141c]/95 border border-[var(--border)] p-3.5 sm:p-4 space-y-3 shadow-xl backdrop-blur-md">
      {/* Top Header Badge */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
          <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">
            {t("workout.hud_badge")}
          </span>
          <span className="text-[var(--border)]">•</span>
          <span className="text-xs font-semibold text-white truncate max-w-[180px] sm:max-w-[280px]">
            {workoutName}
          </span>
        </div>

        {/* Step Index Counter */}
        <div className="text-xs font-bold text-[var(--muted)]">
          {stepIndex + 1} / {totalSteps}
        </div>
      </div>

      {/* Main Active Step Row */}
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
            >
              {repeatIndex && totalRepeats
                ? `${step.type === "work" ? "Tiro" : "Recuperação"} ${repeatIndex}/${totalRepeats}`
                : step.name || (language === "en" ? badge.nameEn : badge.namePt)}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
              {remainingText}
            </span>
          </div>
        </div>

        {/* Skip Step / Lap Button */}
        <button
          type="button"
          onClick={onSkipStep}
          className="btn-ghost text-xs px-3 py-2 border-white/20 hover:border-white/40 flex items-center gap-1.5 shrink-0 bg-white/5 active:scale-95 transition-all"
        >
          <SkipForward size={15} />
          <span>{t("workout.skip_step_btn")}</span>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden border border-white/5">
          <div
            className={`h-full transition-all duration-300 ${badge.dotColor}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Target Pace Bar / Status (for Running) */}
      {step.paceTarget && (
        <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <Gauge size={14} className="text-orange-400" />
            <span className="text-[var(--muted)]">{t("workout.target_pace")}:</span>
            <span className="font-bold text-white font-mono">{paceRangeStr}</span>
          </div>

          {paceStatus && (
            <div className="flex items-center gap-1 font-bold">
              {paceStatus === "on_target" && (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  {t("workout.pace_on_target")}
                </span>
              )}
              {paceStatus === "too_slow" && (
                <span className="text-amber-400 flex items-center gap-1 animate-pulse">
                  <TrendingUp size={13} />
                  {t("workout.pace_too_slow")}
                </span>
              )}
              {paceStatus === "too_fast" && (
                <span className="text-rose-400 flex items-center gap-1 animate-pulse">
                  <TrendingDown size={13} />
                  {t("workout.pace_too_fast")}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Target Power Bar / Status (for Cycling) */}
      {resolvedPower && (
        <div className="p-2.5 rounded-xl bg-black/30 border border-amber-500/20 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <Zap size={14} className="text-amber-400 fill-amber-400 shrink-0" />
            <span className="text-[var(--muted)]">{t("workout.target_power")}:</span>
            <span className="font-bold text-amber-300 font-mono truncate">{resolvedPower.label}</span>
          </div>

          {powerStatus && (
            <div className="flex items-center gap-1 font-bold shrink-0">
              {powerStatus === "on_target" && (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  {t("workout.power_on_target")}
                </span>
              )}
              {powerStatus === "too_low" && (
                <span className="text-amber-400 flex items-center gap-1 animate-pulse">
                  <TrendingUp size={13} />
                  {t("workout.power_too_low")}
                </span>
              )}
              {powerStatus === "too_high" && (
                <span className="text-rose-400 flex items-center gap-1 animate-pulse">
                  <TrendingDown size={13} />
                  {t("workout.power_too_high")}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Target Cadence Bar / Status (for Cycling / Drills) */}
      {step.cadenceTarget && (
        <div className="p-2.5 rounded-xl bg-black/30 border border-cyan-500/20 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <RefreshCw size={14} className="text-cyan-400 shrink-0" />
            <span className="text-[var(--muted)]">{t("workout.target_cadence")}:</span>
            <span className="font-bold text-cyan-300 font-mono">{cadenceRangeStr}</span>
          </div>

          {cadenceStatus && (
            <div className="flex items-center gap-1 font-bold shrink-0">
              {cadenceStatus === "on_target" && (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  {t("workout.cadence_on_target")}
                </span>
              )}
              {cadenceStatus === "too_low" && (
                <span className="text-amber-400 flex items-center gap-1 animate-pulse">
                  <TrendingUp size={13} />
                  {t("workout.cadence_too_low")}
                </span>
              )}
              {cadenceStatus === "too_high" && (
                <span className="text-rose-400 flex items-center gap-1 animate-pulse">
                  <TrendingDown size={13} />
                  {t("workout.cadence_too_high")}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Next Step Preview */}
      {nextStep && (
        <div className="flex items-center justify-between text-[11px] text-[var(--muted)] pt-1 border-t border-[var(--border)]/40">
          <span className="flex items-center gap-1 font-semibold">
            <ChevronRight size={13} className="text-orange-400" />
            {t("workout.next_step")}:
          </span>
          <span className="font-medium text-white truncate">
            {nextStep.repeatIndex && nextStep.totalRepeats
              ? `${nextStep.step.type === "work" ? "Tiro" : "Recuperação"} ${nextStep.repeatIndex}/${nextStep.totalRepeats}`
              : nextStep.step.name || (language === "en" ? getStepTypeBadgeStyle(nextStep.step.type).nameEn : getStepTypeBadgeStyle(nextStep.step.type).namePt)}{" "}
            ({formatStepTargetDescription(nextStep.step.targetType, nextStep.step.targetValue, language)})
          </span>
        </div>
      )}
    </div>
  );
}