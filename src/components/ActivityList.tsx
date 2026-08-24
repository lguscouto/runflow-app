import React, { useState, useEffect, useRef, memo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Footprints, Trophy } from "lucide-react";
import type { ActivitySummary } from "@/lib/types";
import { PRCategory } from "@/lib/prs";
import {
  formatDate,
  formatDistance,
  formatDuration,
  formatCalories,
  formatSportSpeedOrPace,
  sportLabel,
} from "@/lib/format";
import { useI18n, type Language } from "@/lib/i18n";
import { haptics } from "@/lib/haptics";

const PR_CATEGORY_KEYS: Record<PRCategory, string> = {
  longestDistance: "prs.longest_distance",
  bestPace: "prs.best_pace",
  longestDuration: "prs.longest_duration",
  highestElevation: "prs.highest_elevation",
  highestAvgSpeed: "prs.cycling_highest_avg_speed",
  maxSpeed: "prs.cycling_max_speed",
  bestPower: "prs.cycling_best_power",
};

const ESTIMATED_ROW_HEIGHT = 74; // Altura média em px de cada linha de atividade
const OVERSCAN_COUNT = 5; // Buffer de linhas acima e abaixo da viewport

interface ActivityRowProps {
  activity: ActivitySummary;
  prCategories?: PRCategory[];
  language: Language;
  t: (key: string) => string;
}

const ActivityRowItem = memo(function ActivityRowItem({
  activity,
  prCategories,
  language,
  t,
}: ActivityRowProps) {
  return (
    <Link
      href={`/atividades/ver/?id=${activity.id}`}
      onClick={() => haptics.light()}
      className="activity-row cursor-pointer touch-target py-3.5"
      style={{ minHeight: `${ESTIMATED_ROW_HEIGHT}px` }}
    >
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold">{activity.name}</p>
          {prCategories && prCategories.length > 0 && (
            <span
              className="inline-flex items-center justify-center p-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/25 shrink-0"
              title={`${t("prs.title")}: ${prCategories
                .map((cat) => t(PR_CATEGORY_KEYS[cat]) || cat)
                .join(", ")}`}
            >
              <Trophy size={12} className="fill-amber-500/20" />
            </span>
          )}
        </div>
        <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">
          {sportLabel(activity.sport, language)} · {formatDate(activity.startedAt, language)}
        </p>
      </div>
      <div className="text-right flex items-center gap-2">
        <div>
          <p className="font-semibold text-[var(--accent)] text-sm sm:text-base">
            {formatDistance(activity.distanceM)}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {formatDuration(activity.durationSec)} · {formatSportSpeedOrPace(activity.sport, activity.avgPaceSecKm, activity.avgSpeedKmh)}
            {activity.calories != null && activity.calories > 0 && (
              <> · {formatCalories(activity.calories)}</>
            )}
          </p>
        </div>
        <ChevronRight size={18} className="text-[var(--muted)] shrink-0" />
      </div>
    </Link>
  );
});

export function ActivityList({
  activities,
  emptyMessage,
  prMap = {},
}: {
  activities: ActivitySummary[];
  emptyMessage?: string;
  prMap?: Record<string, PRCategory[]>;
}) {
  const { t, language } = useI18n();
  const router = useRouter();
  const [creatingDemo, setCreatingDemo] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(800);

  const displayEmptyMessage = emptyMessage ?? t("activities.empty");

  // Virtualização de janela de renderização baseada na posição do scroll da janela
  useEffect(() => {
    if (typeof window === "undefined" || activities.length <= 25) return;

    setViewportHeight(window.innerHeight);

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            // Distância do topo do container em relação ao topo da janela
            const offsetTop = Math.max(0, -rect.top);
            setScrollTop(offsetTop);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    const handleResize = () => {
      setViewportHeight(window.innerHeight);
      handleScroll();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [activities.length]);

  async function handleLoadDemo() {
    setCreatingDemo(true);
    try {
      const { createDemoActivity, saveActivity } = await import("@/lib/activities");
      const demo = createDemoActivity();
      const id = await saveActivity(demo, "demo");
      router.push(`/atividades/ver/?id=${id}`);
    } catch (e) {
      console.error("Erro ao criar treino demo:", e);
      setCreatingDemo(false);
    }
  }

  if (activities.length === 0) {
    return (
      <div className="stat-card text-center py-12 text-[var(--muted)]">
        <Footprints className="mx-auto mb-3 opacity-50" size={40} />
        <p>{displayEmptyMessage}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-4">
          <Link href="/importar/" className="btn-primary">
            {t("activities.import_btn")}
          </Link>
          <button
            type="button"
            onClick={handleLoadDemo}
            disabled={creatingDemo}
            className="btn-ghost text-xs text-[var(--accent)] border-[var(--accent)]/30 hover:border-[var(--accent)]"
          >
            {creatingDemo ? "Criando treino demo..." : "✨ Carregar Treino de Demonstração"}
          </button>
        </div>
      </div>
    );
  }

  // Para listas pequenas (< 25), renderiza diretamente sem overhead
  if (activities.length <= 25) {
    return (
      <div className="stat-card overflow-hidden p-0">
        {activities.map((a) => (
          <ActivityRowItem
            key={a.id}
            activity={a}
            prCategories={prMap[a.id]}
            language={language}
            t={t}
          />
        ))}
      </div>
    );
  }

  // Virtualização com janela deslizante para listas médias/grandes
  const totalCount = activities.length;
  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / ESTIMATED_ROW_HEIGHT) - OVERSCAN_COUNT
  );
  const visibleCount = Math.ceil(viewportHeight / ESTIMATED_ROW_HEIGHT) + 2 * OVERSCAN_COUNT;
  const endIndex = Math.min(totalCount, startIndex + visibleCount);

  const topPadding = startIndex * ESTIMATED_ROW_HEIGHT;
  const bottomPadding = Math.max(0, (totalCount - endIndex) * ESTIMATED_ROW_HEIGHT);
  const visibleActivities = activities.slice(startIndex, endIndex);

  return (
    <div ref={containerRef} className="stat-card overflow-hidden p-0">
      {topPadding > 0 && (
        <div style={{ height: `${topPadding}px` }} aria-hidden="true" />
      )}

      {visibleActivities.map((a) => (
        <ActivityRowItem
          key={a.id}
          activity={a}
          prCategories={prMap[a.id]}
          language={language}
          t={t}
        />
      ))}

      {bottomPadding > 0 && (
        <div style={{ height: `${bottomPadding}px` }} aria-hidden="true" />
      )}
    </div>
  );
}
