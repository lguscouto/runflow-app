"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Flame } from "lucide-react";
import { ActivityList } from "@/components/ActivityList";
import { AdvancedStatsPanel } from "@/components/AdvancedStatsPanel";
import { useActivityList } from "@/hooks/useActivities";
import { getUserProfile } from "@/lib/profile";
import { getPersonalRecords, getPRMap, type PRCategory } from "@/lib/prs";
import { useI18n } from "@/lib/i18n";

const PersonalHeatmap = dynamic(
  () => import("@/components/PersonalHeatmap").then((m) => m.PersonalHeatmap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[520px] w-full rounded-2xl bg-[#0d1117] border border-[var(--border)] animate-pulse flex flex-col items-center justify-center gap-3 text-[var(--muted)] text-sm">
        <Flame size={32} className="text-orange-500 animate-bounce" />
        <span>Carregando mapa de calor...</span>
      </div>
    ),
  }
);

export function ActivitiesPageClient() {
  const { t } = useI18n();
  const { activities, loading, loadingMore, hasMore, loadMore } =
    useActivityList();
  const [prMap, setPrMap] = useState<Record<string, PRCategory[]>>({});
  const [activeTab, setActiveTab] = useState<"list" | "stats" | "heatmap">("list");

  useEffect(() => {
    if (activities.length === 0) return;
    async function loadPRs() {
      try {
        const profile = await getUserProfile();
        const prs = getPersonalRecords(activities, profile);
        setPrMap(getPRMap(activities, prs));
      } catch (err) {
        console.error("Erro ao calcular recordes no histórico:", err);
      }
    }
    loadPRs();
  }, [activities]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t("activities.title")}</h1>
          <p className="text-[var(--muted)] text-sm">
            {loading
              ? t("common.loading")
              : t("activities.registered_count", { count: activities.length })}
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
              ? "bg-orange-500/15 text-orange-400 border border-orange-500/30 shadow-sm"
              : "text-[var(--muted)] hover:text-[var(--text)]"
          }`}
        >
          <Flame size={14} className={activeTab === "heatmap" ? "text-orange-400" : "text-[var(--muted)]"} />
          <span>{t("stats.tab_heatmap")}</span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-[var(--muted)] text-sm">
          {t("common.loading")}
        </div>
      ) : activeTab === "list" ? (
        <ActivityList
          activities={activities}
          prMap={prMap}
          onLoadMore={loadMore}
          hasMore={hasMore}
          loadingMore={loadingMore}
        />
      ) : activeTab === "stats" ? (
        <AdvancedStatsPanel activities={activities} />
      ) : (
        <PersonalHeatmap />
      )}
    </div>
  );
}


