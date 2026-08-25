"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Play, Upload, Zap, Flame } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { ActivityList } from "@/components/ActivityList";
import { WeeklyGoalsCard } from "@/components/WeeklyGoalsCard";
import { useDashboard } from "@/hooks/useActivities";
import { formatDistance, formatDuration } from "@/lib/format";
import { getUserProfile } from "@/lib/profile";
import { getPersonalRecords, getPRMap, type PersonalRecords, type PRCategory } from "@/lib/prs";
import { getAllStoredSummaries } from "@/lib/storage";
import { PersonalRecordsCard } from "@/components/PersonalRecordsCard";
import { ConsistencyStreakCard } from "@/components/ConsistencyStreakCard";
import { estimateUserVO2Max, calculateRacePredictions } from "@/lib/vo2max";
import { VO2MaxFitnessCard } from "@/components/VO2MaxFitnessCard";
import { RacePredictorCard } from "@/components/RacePredictorCard";
import type { VO2MaxEstimate, RacePrediction, ActivitySummary } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

export function HomePageClient() {
  const { t } = useI18n();
  const { stats, recent, loading, error, refresh } = useDashboard();
  const [activitiesList, setActivitiesList] = useState<ActivitySummary[]>([]);
  const [prs, setPrs] = useState<PersonalRecords | null>(null);
  const [prMap, setPrMap] = useState<Record<string, PRCategory[]>>({});
  const [vo2Estimate, setVo2Estimate] = useState<VO2MaxEstimate | null>(null);
  const [racePredictions, setRacePredictions] = useState<RacePrediction[]>([]);
  const [loadingPrs, setLoadingPrs] = useState(true);
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    async function loadPRs() {
      try {
        const [profile, allActivities] = await Promise.all([
          getUserProfile(),
          getAllStoredSummaries(),
        ]);
        setActivitiesList(allActivities);
        if (profile?.name) {
          setProfileName(profile.name);
        }
        const computedPrs = getPersonalRecords(allActivities, profile);
        setPrs(computedPrs);
        setPrMap(getPRMap(allActivities, computedPrs));

        // Calcular VO2 Max e Previsões de Provas
        const estimatedVo2 = estimateUserVO2Max(allActivities, profile);
        setVo2Estimate(estimatedVo2);

        const predictions = calculateRacePredictions(allActivities, profile);
        setRacePredictions(predictions);
      } catch (err) {
        console.error("Erro ao calcular métricas de performance:", err);
      } finally {
        setLoadingPrs(false);
      }
    }
    loadPRs();
  }, [recent]);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          {profileName ? t("home.greeting", { name: profileName }) : t("home.title")}
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

      <ConsistencyStreakCard activities={activitiesList} />

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
