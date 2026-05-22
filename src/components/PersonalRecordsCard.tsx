"use client";

import Link from "next/link";
import { Trophy, Zap, Clock, Compass, Landmark } from "lucide-react";
import { PersonalRecords } from "@/lib/prs";
import { formatDistance, formatDuration, formatPace, formatElevation } from "@/lib/format";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { useI18n } from "@/lib/i18n";

interface PersonalRecordsCardProps {
  prs: PersonalRecords;
}

export function PersonalRecordsCard({ prs }: PersonalRecordsCardProps) {
  const { t, language } = useI18n();
  const { longestDistance, bestPace, longestDuration, highestElevation } = prs;

  const hasAnyPR = !!(longestDistance || bestPace || longestDuration || highestElevation);

  if (!hasAnyPR) {
    return (
      <section className="stat-card">
        <div className="flex items-center gap-3">
          <Trophy size={22} className="text-amber-500 shrink-0" />
          <div>
            <p className="font-semibold text-lg">{t("prs.title")}</p>
            <p className="text-sm text-[var(--muted)]">
              {t("prs.empty")}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const items = [
    {
      id: "longestDistance",
      label: t("prs.longest_distance"),
      activity: longestDistance,
      value: longestDistance ? formatDistance(longestDistance.distanceM) : "—",
      icon: <Compass className="text-blue-400" size={18} />,
      bgClass: "bg-blue-500/10 border-blue-500/20",
    },
    {
      id: "bestPace",
      label: t("prs.best_pace"),
      activity: bestPace,
      value: bestPace ? formatPace(bestPace.avgPaceSecKm) : "—",
      icon: <Zap className="text-amber-500" size={18} />,
      bgClass: "bg-amber-500/10 border-amber-500/20",
    },
    {
      id: "longestDuration",
      label: t("prs.longest_duration"),
      activity: longestDuration,
      value: longestDuration ? formatDuration(longestDuration.durationSec) : "—",
      icon: <Clock className="text-emerald-400" size={18} />,
      bgClass: "bg-emerald-500/10 border-emerald-500/20",
    },
    {
      id: "highestElevation",
      label: t("prs.highest_elevation"),
      activity: highestElevation,
      value: highestElevation ? formatElevation(highestElevation.elevationGainM) : "—",
      icon: <Landmark className="text-purple-400" size={18} />,
      bgClass: "bg-purple-500/10 border-purple-500/20",
    },
  ];

  return (
    <section className="stat-card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Trophy size={20} className="text-amber-500 animate-bounce" />
          {t("prs.title")}
        </h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((item) => {
          const act = item.activity;
          const content = (
            <div className="flex flex-col h-full justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[var(--muted)] font-medium uppercase tracking-wider">
                  {item.label}
                </span>
                <span className={`p-1.5 rounded-lg border ${item.bgClass}`}>
                  {item.icon}
                </span>
              </div>
              <div className="mt-2">
                <p className="text-xl font-bold tracking-tight text-[var(--text)]">
                  {item.value}
                </p>
                {act ? (
                  <p className="text-[10px] text-[var(--muted)] mt-1 truncate">
                    {format(
                      new Date(act.startedAt),
                      language === "en" ? "MMM d, yyyy" : "d 'de' MMM 'de' yyyy",
                      { locale: language === "en" ? enUS : ptBR }
                    )}
                  </p>
                ) : (
                  <p className="text-[10px] text-[var(--muted)] mt-1">
                    {t("common.no_data")}
                  </p>
                )}
              </div>
            </div>
          );

          if (act) {
            return (
              <Link
                key={item.id}
                href={`/atividades/ver/?id=${act.id}`}
                className="block p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--accent)] hover:shadow-sm transition-all duration-200"
              >
                {content}
              </Link>
            );
          }

          return (
            <div
              key={item.id}
              className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)]/50 opacity-60"
            >
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
