"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Play, Upload, Zap } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { ActivityList } from "@/components/ActivityList";
import { WeeklyGoalsCard } from "@/components/WeeklyGoalsCard";
import { useDashboard } from "@/hooks/useActivities";
import { formatDistance, formatDuration } from "@/lib/format";
import { getUserProfile } from "@/lib/profile";
import { listActivities } from "@/lib/activities";
import { getPersonalRecords, getPRMap, type PersonalRecords, type PRCategory } from "@/lib/prs";
import { PersonalRecordsCard } from "@/components/PersonalRecordsCard";
import { useI18n } from "@/lib/i18n";

export function HomePageClient() {
  const { t } = useI18n();
  const { stats, recent, loading } = useDashboard();
  const [prs, setPrs] = useState<PersonalRecords | null>(null);
  const [prMap, setPrMap] = useState<Record<string, PRCategory[]>>({});
  const [loadingPrs, setLoadingPrs] = useState(true);

  useEffect(() => {
    async function loadPRs() {
      try {
        const [profile, allActivities] = await Promise.all([
          getUserProfile(),
          listActivities(1000),
        ]);
        const computedPrs = getPersonalRecords(allActivities, profile);
        setPrs(computedPrs);
        setPrMap(getPRMap(allActivities, computedPrs));
      } catch (err) {
        console.error("Erro ao calcular recordes pessoais:", err);
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
          {t("home.title")}
        </h1>
        <p className="text-[var(--muted)] max-w-xl">
          {t("home.subtitle")}
        </p>
      </section>

      <Link
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
        <Link href="/importar/" className="btn-ghost">
          <Upload size={18} />
          {t("home.import_btn")}
        </Link>
        <Link href="/atividades/" className="btn-ghost">
          {t("home.view_all_btn")}
        </Link>
      </div>

      <WeeklyGoalsCard />

      {loadingPrs ? (
        <div className="stat-card">
          <p className="text-sm text-[var(--muted)]">{t("home.loading_records")}</p>
        </div>
      ) : (
        prs && <PersonalRecordsCard prs={prs} />
      )}

      {loading || !stats ? (
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
