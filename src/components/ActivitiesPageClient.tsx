"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Flame } from "lucide-react";
import { ActivityList } from "@/components/ActivityList";
import { AdvancedStatsPanel } from "@/components/AdvancedStatsPanel";
import { useActivityList, useActivityAnalytics } from "@/hooks/useActivities";
import { getUserProfile } from "@/lib/profile";
import { getPersonalRecords, getPRMap, type PRCategory } from "@/lib/prs";
import { useI18n } from "@/lib/i18n";
import { ActivityListSkeleton, AnalyticsSkeleton, MapSkeleton } from "@/components/LoadingSkeletons";

const PersonalHeatmap = dynamic(
  () => import("@/components/PersonalHeatmap").then((m) => m.PersonalHeatmap),
  {
    ssr: false,
    loading: () => (
      <MapSkeleton label="Carregando mapa de calor / Loading heatmap" height={520} />
    ),
  }
);

export function ActivitiesPageClient() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<"list" | "stats" | "heatmap">("list");
  const {
    activities,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    retryLoadMore,
    error,
    totalCount,
  } = useActivityList();
  const {
    activities: analyticsActivities,
    loading: analyticsLoading,
    error: analyticsError,
    refresh: refreshAnalytics,
  } = useActivityAnalytics(activeTab === "stats");
  const [prMap, setPrMap] = useState<Record<string, PRCategory[]>>({});

  useEffect(() => {
    const prActivities =
      analyticsActivities.length > 0 ? analyticsActivities : activities;
    if (prActivities.length === 0) {
      setPrMap({});
      return;
    }

    let active = true;
    async function loadPRs() {
      try {
        const profile = await getUserProfile();
        const prs = getPersonalRecords(prActivities, profile);
        if (active) {
          setPrMap(getPRMap(prActivities, prs));
        }
      } catch (err) {
        console.error("Erro ao calcular recordes no histórico:", err);
      }
    }
    loadPRs();
    return () => {
      active = false;
    };
  }, [activities, analyticsActivities]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t("activities.title")}</h1>
          <p className="text-[var(--muted)] text-sm">
            {loading
              ? <span className="inline-block align-middle"><span className="sr-only">{t("common.loading")}</span><span aria-hidden="true" className="skeleton h-3 w-28" /></span>
              : t("activities.registered_count", { count: totalCount })}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-[var(--surface)] border border-[var(--border)] rounded-lg p-1 gap-1">
        <button
          onClick={() => setActiveTab("list")}
          className={`flex-1 py-2 text-center text-xs sm:text-sm font-semibold rounded-md transition-all cursor-pointer ${
            activeTab === "list"
              ? "bg-[var(--surface-hover)] text-[var(--text)] shadow-sm"
              : "text-[var(--muted)] hover:text-[var(--text)]"
          }`}
        >
          {t("stats.tab_list")}
        </button>
        <button
          onClick={() => setActiveTab("stats")}
          className={`flex-1 py-2 text-center text-xs sm:text-sm font-semibold rounded-md transition-all cursor-pointer ${
            activeTab === "stats"
              ? "bg-[var(--surface-hover)] text-[var(--text)] shadow-sm"
              : "text-[var(--muted)] hover:text-[var(--text)]"
          }`}
        >
          {t("stats.tab_charts")}
        </button>
        <button
          onClick={() => setActiveTab("heatmap")}
          className={`flex-1 py-2 text-center text-xs sm:text-sm font-semibold rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === "heatmap"
              ? "bg-orange-500/15 text-[var(--color-status-warning)] border border-orange-500/30 shadow-sm"
              : "text-[var(--muted)] hover:text-[var(--text)]"
          }`}
        >
          <Flame size={14} className={activeTab === "heatmap" ? "text-[var(--color-status-warning)]" : "text-[var(--muted)]"} />
          <span>{t("stats.tab_heatmap")}</span>
        </button>
      </div>

      {loading ? (
        <ActivityListSkeleton label={t("common.loading")} />
      ) : activeTab === "list" ? (
        <ActivityList
          activities={activities}
          prMap={prMap}
          onLoadMore={loadMore}
          onRetry={retryLoadMore}
          error={error}
          hasMore={hasMore}
          loadingMore={loadingMore}
        />
      ) : activeTab === "stats" ? (
        analyticsLoading ? (
          <AnalyticsSkeleton label={t("common.loading")} />
        ) : analyticsError ? (
          <div role="alert" className="py-12 text-center text-[var(--muted)] text-sm">
            <p>{t("activities.stats_load_error")}</p>
            <button
              type="button"
              className="mt-3 underline"
              onClick={refreshAnalytics}
            >
              {t("common.retry")}
            </button>
          </div>
        ) : (
          <AdvancedStatsPanel activities={analyticsActivities} />
        )
      ) : (
        <PersonalHeatmap />
      )}
    </div>
  );
}


