import Link from "next/link";
import { ChevronRight, Footprints, Trophy } from "lucide-react";
import type { ActivitySummary } from "@/lib/types";
import { PRCategory } from "@/lib/prs";
import {
  formatDate,
  formatDistance,
  formatDuration,
  formatCalories,
  formatPace,
  sportLabel,
} from "@/lib/format";
import { useI18n } from "@/lib/i18n";

const PR_CATEGORY_KEYS: Record<PRCategory, string> = {
  longestDistance: "prs.longest_distance",
  bestPace: "prs.best_pace",
  longestDuration: "prs.longest_duration",
  highestElevation: "prs.highest_elevation",
};

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

  const displayEmptyMessage = emptyMessage ?? t("activities.empty");

  if (activities.length === 0) {
    return (
      <div className="stat-card text-center py-12 text-[var(--muted)]">
        <Footprints className="mx-auto mb-3 opacity-50" size={40} />
        <p>{displayEmptyMessage}</p>
        <Link href="/importar/" className="btn-primary mt-4 inline-flex">
          {t("activities.import_btn")}
        </Link>
      </div>
    );
  }

  return (
    <div className="stat-card overflow-hidden p-0">
      {activities.map((a) => {
        const prCategories = prMap[a.id];
        return (
          <Link
            key={a.id}
            href={`/atividades/ver/?id=${a.id}`}
            className="activity-row block"
          >
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold">{a.name}</p>
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
              <p className="text-sm text-[var(--muted)]">
                {sportLabel(a.sport, language)} · {formatDate(a.startedAt, language)}
              </p>
            </div>
            <div className="text-right flex items-center gap-2">
              <div>
                <p className="font-semibold text-[var(--accent)]">
                  {formatDistance(a.distanceM)}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  {formatDuration(a.durationSec)} · {formatPace(a.avgPaceSecKm)}
                  {a.calories != null && a.calories > 0 && (
                    <> · {formatCalories(a.calories)}</>
                  )}
                </p>
              </div>
              <ChevronRight size={18} className="text-[var(--muted)]" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
