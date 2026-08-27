"use client";

import React, { useMemo } from "react";
import { Flame, Trophy, Calendar, Check, Zap } from "lucide-react";
import type { ActivitySummary } from "@/lib/types";
import { calculateConsistencyStreaks } from "@/lib/streaks";
import { fireStreakConfetti } from "@/lib/confetti";
import { haptics } from "@/lib/haptics";
import { useI18n } from "@/lib/i18n";
import { formatDistance } from "@/lib/format";

interface ConsistencyStreakCardProps {
  activities: ActivitySummary[];
}

export function ConsistencyStreakCard({ activities }: ConsistencyStreakCardProps) {
  const { t } = useI18n();

  const streakInfo = useMemo(() => {
    return calculateConsistencyStreaks(activities);
  }, [activities]);

  const daysLabels = [
    t("streaks.days_mon"),
    t("streaks.days_tue"),
    t("streaks.days_wed"),
    t("streaks.days_thu"),
    t("streaks.days_fri"),
    t("streaks.days_sat"),
    t("streaks.days_sun"),
  ];

  // Determinar o dia da semana atual (0 = Seg, 6 = Dom)
  const currentDayOfWeek = (new Date().getDay() + 6) % 7;

  const handleCardClick = () => {
    haptics.medium();
    if (streakInfo.currentStreakWeeks > 0 || streakInfo.isThisWeekCompleted) {
      fireStreakConfetti();
    }
  };

  const flameColors = {
    inactive: "text-zinc-500 from-zinc-500/20 to-zinc-700/20 border-zinc-700/40",
    warm: "text-[var(--color-status-warning)] from-amber-500/20 to-orange-600/20 border-amber-500/40",
    fire: "text-[var(--accent)] from-orange-500/25 to-red-600/25 border-orange-500/50",
    blaze: "text-[var(--color-status-danger)] from-rose-500/30 to-amber-500/30 border-rose-500/60",
    legend: "text-[var(--color-status-warning)] from-yellow-500/30 via-orange-500/30 to-purple-600/30 border-yellow-500/70",
  };

  return (
    <div
      onClick={handleCardClick}
      className="stat-card relative overflow-hidden border border-[var(--border)] bg-[var(--surface)] hover:border-orange-500/50 transition-all cursor-pointer select-none group"
    >
      {/* Background glow when streak is active */}
      {streakInfo.currentStreakWeeks > 0 && (
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-gradient-to-br from-orange-500/15 via-red-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
      )}

      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border bg-gradient-to-br transition-transform group-hover:scale-105 ${
              flameColors[streakInfo.flameLevel]
            }`}
          >
            <Flame
              size={20}
              className={`${
                streakInfo.currentStreakWeeks > 0
                  ? "animate-pulse drop-shadow-[0_0_8px_var(--color-effect-streak-glow)]"
                  : ""
              }`}
            />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-1.5">
              {t("streaks.title")}
            </h3>
            <p className="text-[11px] text-[var(--muted)]">
              {t(streakInfo.streakTitleKey)}
            </p>
          </div>
        </div>

        {streakInfo.longestStreakWeeks > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-[var(--muted)] font-medium px-2 py-0.5 rounded-full bg-[var(--surface-hover)] border border-[var(--border)]">
            <Trophy size={12} className="text-yellow-400" />
            <span>
              {t("streaks.longest_record", { count: streakInfo.longestStreakWeeks })}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[var(--text)] tracking-tight font-mono">
              {streakInfo.currentStreakWeeks}
            </span>
            <span className="text-sm font-semibold text-[var(--accent)]">
              {streakInfo.currentStreakWeeks === 1
                ? t("streaks.single_week")
                : t("streaks.weeks_count", { count: streakInfo.currentStreakWeeks })}
            </span>
          </div>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {streakInfo.isThisWeekCompleted
              ? t("streaks.week_done")
              : t("streaks.keep_flame_alive")}
          </p>
        </div>

        {streakInfo.thisWeekCount > 0 && (
          <div className="text-left sm:text-right">
            <p className="text-[11px] text-[var(--muted)] font-medium">
              {t("streaks.this_week_workouts", { count: streakInfo.thisWeekCount })}
            </p>
            <p className="text-sm font-bold text-[var(--accent)] font-mono">
              {formatDistance(streakInfo.thisWeekDistanceM)}
            </p>
          </div>
        )}
      </div>

      {/* Mini 7-day visualizer (Seg a Dom) */}
      <div className="pt-2 border-t border-[var(--border)]">
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {daysLabels.map((dayLabel, idx) => {
            const isCompleted = streakInfo.activeDaysThisWeek[idx];
            const isToday = idx === currentDayOfWeek;

            let circleClass =
              "bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--muted)]";
              if (isCompleted) {
              circleClass =
              "bg-[var(--accent)] border-[var(--accent)] text-[var(--on-accent)] font-bold shadow-md shadow-orange-500/20";
              } else if (isToday) {
              circleClass =
                "border-orange-400/80 bg-orange-500/10 text-[var(--color-status-warning)] font-bold animate-pulse";
            }

            return (
              <div key={idx} className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-[var(--muted)]">
                  {dayLabel}
                </span>
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all ${circleClass}`}
                >
                  {isCompleted ? (
                    <Check size={14} strokeWidth={3} />
                  ) : (
                    <span className="text-[10px] opacity-70">
                      {isToday ? "•" : ""}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
