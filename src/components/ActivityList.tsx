import { useState, useRef, memo, forwardRef, useCallback, useEffect, useLayoutEffect, type CSSProperties } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Footprints, Trophy, Loader2 } from "lucide-react";
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
import { ActivityListSkeleton } from "@/components/LoadingSkeletons";

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
const OVERSCAN_COUNT = 6; // Buffer de linhas acima e abaixo da viewport

interface ActivityRowProps {
  activity: ActivitySummary;
  prCategories?: PRCategory[];
  language: Language;
  t: (key: string) => string;
  virtualIndex?: number;
  style?: CSSProperties;
}

const ActivityRowItem = memo(
  forwardRef<HTMLAnchorElement, ActivityRowProps>(function ActivityRowItem(
    { activity, prCategories, language, t, virtualIndex, style },
    ref,
  ) {
    return (
      <Link
        ref={ref}
        href={`/atividades/ver/?id=${activity.id}`}
        onClick={() => haptics.light()}
        className="activity-row cursor-pointer touch-target py-3.5"
        data-index={virtualIndex}
        style={{ minHeight: `${ESTIMATED_ROW_HEIGHT}px`, ...style }}
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
  }),
);

export function ActivityList({
  activities,
  emptyMessage,
  prMap = {},
  onLoadMore,
  hasMore = false,
  loadingMore = false,
  error = null,
  onRetry,
}: {
  activities: ActivitySummary[];
  emptyMessage?: string;
  prMap?: Record<string, PRCategory[]>;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const { t, language } = useI18n();
  const router = useRouter();
  const [creatingDemo, setCreatingDemo] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const rowVirtualizer = useWindowVirtualizer({
    count: activities.length,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 8,
    useFlushSync: false,
    scrollMargin,
    getItemKey: (index) => activities[index]?.id ?? index,
  });

  const updateScrollMargin = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const nextScrollMargin = container.getBoundingClientRect().top + window.scrollY;
    setScrollMargin((current) => current === nextScrollMargin ? current : nextScrollMargin);
  }, []);

  useLayoutEffect(() => {
    updateScrollMargin();
  });

  useEffect(() => {
    window.addEventListener("resize", updateScrollMargin);
    return () => window.removeEventListener("resize", updateScrollMargin);
  }, [updateScrollMargin]);

  const measureRow = useCallback(
    (node: HTMLElement | null) => {
      if (!node || typeof window === "undefined") return;
      window.requestAnimationFrame(() => {
        if (node.isConnected) {
          rowVirtualizer.measureElement(node);
        }
      });
    },
    [rowVirtualizer],
  );

  const displayEmptyMessage = emptyMessage ?? t("activities.empty");

  // Observer do sentinel para paginação contínua sob demanda
  // O lock definitivo fica no hook; o observer apenas solicita a próxima página.
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loadingMore || !onLoadMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: "300px" },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

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

  if (activities.length === 0 && error) {
    return (
      <div className="stat-card flex flex-col items-center gap-3 py-12 text-center" role="alert">
        <p className="text-sm text-[var(--muted)]">{t(error)}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="btn-ghost border border-[var(--border)] px-4 py-2 rounded-xl">
            {t("common.retry")}
          </button>
        )}
      </div>
    );
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

  const isVirtualized = activities.length > 25;
  const virtualItems = rowVirtualizer.getVirtualItems();
  const virtualizedRows = isVirtualized
    ? virtualItems.map((virtualRow) => {
        const activity = activities[virtualRow.index];
        if (!activity) return null;
        return (
          <ActivityRowItem
            key={virtualRow.key}
            ref={measureRow}
            virtualIndex={virtualRow.index}
            activity={activity}
            prCategories={prMap[activity.id]}
            language={language}
            t={t}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start - scrollMargin}px)`,
            }}
          />
        );
      })
    : activities.map((activity, index) => (
        <ActivityRowItem
          key={activity.id}
          virtualIndex={index}
          activity={activity}
          prCategories={prMap[activity.id]}
          language={language}
          t={t}
        />
      ));

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="stat-card overflow-hidden p-0"
        style={
          isVirtualized
            ? {
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: "relative",
              }
            : undefined
        }
      >
        {virtualizedRows}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-[var(--color-status-danger)] flex items-center justify-between gap-3"
        >
          <span>{t(error)}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="btn-ghost shrink-0 border border-red-400/40 px-3 py-1.5 rounded-lg"
            >
              {t("common.retry")}
            </button>
          )}
        </div>
      )}

      {/* Sentinel e fallback acessível de carregamento */}
      {hasMore && (
        <>
          <div ref={sentinelRef} className="py-2 text-center">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              aria-busy={loadingMore}
              className="btn-ghost text-xs text-[var(--muted)] hover:text-[var(--text)] border border-[var(--border)] px-4 py-2 rounded-xl inline-flex items-center gap-2"
            >
              {loadingMore && <Loader2 size={14} className="animate-spin text-[var(--accent)]" />}
              <span>{loadingMore ? t("common.loading") : "Carregar mais treinos"}</span>
            </button>
          </div>
          {loadingMore && (
            <ActivityListSkeleton label={t("common.loading")} count={2} />
          )}
        </>
      )}
    </div>
  );
}
