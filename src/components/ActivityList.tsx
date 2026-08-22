import { useState } from "react";
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
  formatPace,
  formatSportSpeedOrPace,
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
  const router = useRouter();
  const [creatingDemo, setCreatingDemo] = useState(false);

  const displayEmptyMessage = emptyMessage ?? t("activities.empty");

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

  return (
    <div className="stat-card overflow-hidden p-0">
      {activities.map((a) => {
        const prCategories = prMap[a.id];
        return (
          <Link
            key={a.id}
            href={`/atividades/ver/?id=${a.id}`}
            className="activity-row cursor-pointer"
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
                  {formatDuration(a.durationSec)} · {formatSportSpeedOrPace(a.sport, a.avgPaceSecKm, a.avgSpeedKmh)}
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
