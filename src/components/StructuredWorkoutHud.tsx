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
} from "lucide-react";
import type { FlatWorkoutStep, WorkoutPaceTarget } from "@/lib/types";
import {
  getStepTypeBadgeStyle,
  formatStepTargetDescription,
  formatStepPaceRange,
} from "@/lib/structured-workout";
import { formatDistance, formatDuration, formatPace } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export interface StructuredWorkoutHudProps {
  currentStep: FlatWorkoutStep;
  nextStep: FlatWorkoutStep | null;
  workoutName: string;
  stepElapsedSec: number;
  stepDistanceM: number;
  currentPaceSecKm: number | null;
  onSkipStep: () => void;
}

export function StructuredWorkoutHud({
  currentStep,
  nextStep,
  workoutName,
  stepElapsedSec,
  stepDistanceM,
  currentPaceSecKm,
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

  // Pace Target Evaluation
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

  const paceRangeStr = formatStepPaceRange(step.paceTarget);

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

      {/* Target Pace Bar / Status (if configured) */}
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