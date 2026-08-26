"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Play, Upload, Zap, Flame } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { ActivityList } from "@/components/ActivityList";
import { WeeklyGoalsCard } from "@/components/WeeklyGoalsCard";
import { useDashboard } from "@/hooks/useActivities";
import { formatDistance, formatDuration } from "@/lib/format";
import { useProfileData } from "@/hooks/useProfileData";
import { getPersonalRecords, getPRMap, type PRCategory } from "@/lib/prs";
import { PersonalRecordsCard } from "@/components/PersonalRecordsCard";
import { ConsistencyStreakCard } from "@/components/ConsistencyStreakCard";
import { estimateUserVO2Max, calculateRacePredictions } from "@/lib/vo2max";
import { VO2MaxFitnessCard } from "@/components/VO2MaxFitnessCard";
import { RacePredictorCard } from "@/components/RacePredictorCard";
import type { VO2MaxEstimate, RacePrediction } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

export function HomePageClient() {
  const { t } = useI18n();
  // Uma única leitura de summaries compartilhada entre stats, recentes e analytics.
  const { stats, recent, summaries, loading, error, refresh } = useDashboard();
  const { profile, loading: loadingProfile } = useProfileData();

  // Métricas derivadas em memória — sem nova leitura do IndexedDB e sem
  // refetch em cascata quando a lista de recentes muda.
  const prs = useMemo(
    () => getPersonalRecords(summaries, profile),
    [summaries, profile],
  );
  const prMap = useMemo(() => getPRMap(summaries, prs), [summaries, prs]);
  const vo2Estimate = useMemo<VO2MaxEstimate | null>(
    () => estimateUserVO2Max(summaries, profile),
    [summaries, profile],
  );
  const racePredictions = useMemo<RacePrediction[]>(
    () => calculateRacePredictions(summaries, profile),
    [summaries, profile],
  );

  const loadingPrs = loading || loadingProfile;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          {profile?.name ? t("home.greeting", { name: profile.name }) : t("home.title")}
        </h1>
        <p className="text-[var(--muted)] max-w-xl">
          {t("home.subtitle")}
        </p>
      </section>

      <Link
        prefetch={false}
        href="/gravar/"
        className="block stat-card border-[var(--accent)]/50 bg-[var(--accent-soft)] hover:border-[var(--accent)] transition-colors"
      >
        <div className="flex items-center gap-4">
          <span className="w-14 h-14 rounded-full bg-[var(--accent)] flex items-center justify-center text-white shrink-0">
            <Play size={28} fill="currentColor" className="ml-1" />
          </span>
          <div>
            <p className="font-bold text-lg">{t("home.start_workout")}</p>
            <p className="text-sm text-[var(--muted)]">
              {t("home.start_workout_sub")}
            </p>
          </div>
        </div>
      </Link>

      <div className="flex flex-wrap gap-3">
        <Link prefetch={false} href="/importar/" className="btn-ghost">
          <Upload size={18} />
          {t("home.import_btn")}
        </Link>
        <Link prefetch={false} href="/atividades/" className="btn-ghost">
          {t("home.view_all_btn")}
        </Link>
        <Link
          prefetch={false}
          href="/heatmap/"
          className="btn-ghost text-orange-400 border border-orange-500/30 hover:border-orange-500/60 hover:bg-orange-500/10 transition-all"
        >
          <Flame size={18} className="text-orange-400 animate-pulse" />
          {t("nav.heatmap")}
        </Link>
      </div>

      <WeeklyGoalsCard />

      <ConsistencyStreakCard activities={summaries} />

      {loadingPrs ? (
        <div className="stat-card">
          <p className="text-sm text-[var(--muted)]">{t("home.loading_records")}</p>
        </div>
      ) : (
        <>
          {prs && <PersonalRecordsCard prs={prs} />}
          {vo2Estimate && <VO2MaxFitnessCard estimate={vo2Estimate} />}
          {racePredictions.length > 0 && (
            <RacePredictorCard predictions={racePredictions} />
          )}
        </>
      )}

      {error ? (
        <div role="alert" className="stat-card flex flex-col items-start gap-3">
          <p className="text-[var(--muted)]">{t(error)}</p>
          <button type="button" className="btn-ghost" onClick={() => void refresh()}>
            {t("common.retry")}
          </button>
        </div>
      ) : loading || !stats ? (
        <p className="text-[var(--muted)]">{t("home.loading_stats")}</p>
      ) : (
        <>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label={t("home.total_distance")}
              value={formatDistance(stats.totalDistanceM)}
            />
            <StatCard
              label={t("home.total_duration")}
              value={formatDuration(stats.totalDurationSec)}
            />
            <StatCard
              label={t("home.this_week")}
              value={formatDistance(stats.thisWeekDistanceM)}
              sub={t("home.workouts_count", { count: stats.thisWeekActivities })}
            />
            <StatCard
              label={t("home.workouts")}
              value={String(stats.totalActivities)}
              sub={t("home.registered")}
            />
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Zap size={20} className="text-[var(--accent)]" />
                {t("home.recent_activities")}
              </h2>
            </div>
            <ActivityList activities={recent} prMap={prMap} />
          </section>
        </>
      )}
    </div>
  );
}
