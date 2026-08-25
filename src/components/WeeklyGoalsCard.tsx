"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Target, Trophy, Settings2 } from "lucide-react";
import { getUserProfile } from "@/lib/profile";
import { getWeeklyProgress, type WeeklyProgress } from "@/lib/goals";
import { formatDistance } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

function ProgressBar({
  label,
  current,
  goal,
  percent,
  complete,
  unit,
}: {
  label: string;
  current: string;
  goal: string;
  percent: number;
  complete: boolean;
  unit: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-[var(--muted)]">{label}</span>
        <span className={complete ? "text-[var(--success)] font-medium" : ""}>
          {current} / {goal} {unit}
        </span>
      </div>
      <div className="h-3 rounded-full bg-[var(--bg)] border border-[var(--border)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            complete ? "bg-[var(--success)]" : "bg-[var(--accent)]"
          }`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  );
}

export function WeeklyGoalsCard() {
  const { t } = useI18n();
  const [progress, setProgress] = useState<WeeklyProgress | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const profile = await getUserProfile();
    setProgress(await getWeeklyProgress(profile));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="stat-card">
        <p className="text-sm text-[var(--muted)]">{t("goals.loading")}</p>
      </div>
    );
  }

  if (!progress) return null;

  if (!progress.anyGoalSet) {
    return (
      <Link
        prefetch={false}
        href="/perfil/"
        className="stat-card block hover:border-[var(--accent)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <Target size={22} className="text-[var(--accent)]" />
          <div>
            <p className="font-medium">{t("goals.set_goals")}</p>
            <p className="text-sm text-[var(--muted)]">
              {t("goals.set_goals_sub")}
            </p>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <section className="stat-card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Target size={20} className="text-[var(--accent)]" />
          {t("profile.weekly_goals")}
        </h2>
        <Link
          prefetch={false}
          href="/perfil/"
          className="text-[var(--muted)] hover:text-[var(--text)]"
          title={t("profile.weekly_goals")}
        >
          <Settings2 size={18} />
        </Link>
      </div>

      {progress.allGoalsComplete && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--success)]/15 border border-[var(--success)]/40">
          <Trophy size={28} className="text-[var(--success)] shrink-0" />
          <div>
            <p className="font-semibold text-[var(--success)]">
              {t("goals.completed")}
            </p>
            <p className="text-sm text-[var(--muted)]">
              {t("goals.completed_sub")}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {progress.distanceGoalKm != null && progress.distanceGoalKm > 0 && (
          <ProgressBar
            label={t("goals.distance")}
            current={formatDistance(progress.distanceM)}
            goal={`${progress.distanceGoalKm} km`}
            percent={progress.distancePercent}
            complete={progress.distanceComplete}
            unit=""
          />
        )}
        {progress.workoutsGoal != null && progress.workoutsGoal > 0 && (
          <ProgressBar
            label={t("goals.workouts")}
            current={String(progress.workoutCount)}
            goal={String(progress.workoutsGoal)}
            percent={progress.workoutsPercent}
            complete={progress.workoutsComplete}
            unit={t("goals.workouts_unit")}
          />
        )}
      </div>
    </section>
  );
}
