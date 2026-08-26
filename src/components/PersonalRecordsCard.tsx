"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Trophy,
  Zap,
  Clock,
  Compass,
  Landmark,
  Gauge,
  Bike,
  Activity as ActivityIcon,
} from "lucide-react";
import { PersonalRecords } from "@/lib/prs";
import {
  formatDistance,
  formatDuration,
  formatPace,
  formatSpeed,
  formatElevation,
  formatWatts,
} from "@/lib/format";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { useI18n } from "@/lib/i18n";
import { haptics } from "@/lib/haptics";

interface PersonalRecordsCardProps {
  prs: PersonalRecords;
}

export function PersonalRecordsCard({ prs }: PersonalRecordsCardProps) {
  const { t, language } = useI18n();
  const [sportTab, setSportTab] = useState<"running" | "cycling">("running");

  const runningPrs = prs.running;
  const cyclingPrs = prs.cycling;

  const hasRunningPR = !!(
    runningPrs.longestDistance ||
    runningPrs.bestPace ||
    runningPrs.longestDuration ||
    runningPrs.highestElevation
  );

  const hasCyclingPR = !!(
    cyclingPrs.longestDistance ||
    cyclingPrs.highestAvgSpeed ||
    cyclingPrs.maxSpeed ||
    cyclingPrs.highestElevation ||
    cyclingPrs.bestPower ||
    cyclingPrs.longestDuration
  );

  const hasAnyPR = hasRunningPR || hasCyclingPR;

  if (!hasAnyPR) {
    return (
      <section className="stat-card">
        <div className="flex items-center gap-3">
          <Trophy size={22} className="text-amber-500 shrink-0" />
          <div>
            <p className="font-semibold text-lg">{t("prs.title")}</p>
            <p className="text-sm text-[var(--muted)]">{t("prs.empty")}</p>
          </div>
        </div>
      </section>
    );
  }

  const runningItems = [
    {
      id: "longestDistance",
      label: t("prs.longest_distance"),
      activity: runningPrs.longestDistance,
      value: runningPrs.longestDistance ? formatDistance(runningPrs.longestDistance.distanceM) : "—",
      icon: <Compass className="text-blue-400" size={18} />,
      bgClass: "bg-blue-500/10 border-blue-500/20",
    },
    {
      id: "bestPace",
      label: t("prs.best_pace"),
      activity: runningPrs.bestPace,
      value: runningPrs.bestPace ? formatPace(runningPrs.bestPace.avgPaceSecKm) : "—",
      icon: <Zap className="text-amber-500" size={18} />,
      bgClass: "bg-amber-500/10 border-amber-500/20",
    },
    {
      id: "longestDuration",
      label: t("prs.longest_duration"),
      activity: runningPrs.longestDuration,
      value: runningPrs.longestDuration ? formatDuration(runningPrs.longestDuration.durationSec) : "—",
      icon: <Clock className="text-emerald-400" size={18} />,
      bgClass: "bg-emerald-500/10 border-emerald-500/20",
    },
    {
      id: "highestElevation",
      label: t("prs.highest_elevation"),
      activity: runningPrs.highestElevation,
      value: runningPrs.highestElevation ? formatElevation(runningPrs.highestElevation.elevationGainM) : "—",
      icon: <Landmark className="text-purple-400" size={18} />,
      bgClass: "bg-purple-500/10 border-purple-500/20",
    },
  ];

  const cyclingItems = [
    {
      id: "longestDistance",
      label: t("prs.cycling_longest_distance"),
      activity: cyclingPrs.longestDistance,
      value: cyclingPrs.longestDistance ? formatDistance(cyclingPrs.longestDistance.distanceM) : "—",
      icon: <Compass className="text-blue-400" size={18} />,
      bgClass: "bg-blue-500/10 border-blue-500/20",
    },
    {
      id: "highestAvgSpeed",
      label: t("prs.cycling_highest_avg_speed"),
      activity: cyclingPrs.highestAvgSpeed,
      value: cyclingPrs.highestAvgSpeed ? formatSpeed(cyclingPrs.highestAvgSpeed.avgSpeedKmh) : "—",
      icon: <Gauge className="text-emerald-400" size={18} />,
      bgClass: "bg-emerald-500/10 border-emerald-500/20",
    },
    {
      id: "maxSpeed",
      label: t("prs.cycling_max_speed"),
      activity: cyclingPrs.maxSpeed,
      value: cyclingPrs.maxSpeed ? formatSpeed(cyclingPrs.maxSpeed.maxSpeedKmh) : "—",
      icon: <Zap className="text-orange-400" size={18} />,
      bgClass: "bg-orange-500/10 border-orange-500/20",
    },
    {
      id: "bestPower",
      label: t("prs.cycling_best_power"),
      activity: cyclingPrs.bestPower,
      value: cyclingPrs.bestPower ? formatWatts(cyclingPrs.bestPower.avgWatts) : "—",
      icon: <Zap className="text-amber-400 fill-amber-400" size={18} />,
      bgClass: "bg-amber-500/10 border-amber-500/20",
    },
    {
      id: "highestElevation",
      label: t("prs.cycling_highest_elevation"),
      activity: cyclingPrs.highestElevation,
      value: cyclingPrs.highestElevation ? formatElevation(cyclingPrs.highestElevation.elevationGainM) : "—",
      icon: <Landmark className="text-purple-400" size={18} />,
      bgClass: "bg-purple-500/10 border-purple-500/20",
    },
    {
      id: "longestDuration",
      label: t("prs.cycling_longest_duration"),
      activity: cyclingPrs.longestDuration,
      value: cyclingPrs.longestDuration ? formatDuration(cyclingPrs.longestDuration.durationSec) : "—",
      icon: <Clock className="text-cyan-400" size={18} />,
      bgClass: "bg-cyan-500/10 border-cyan-500/20",
    },
  ];

  const displayedItems = sportTab === "running" ? runningItems : cyclingItems;

  return (
    <section className="stat-card space-y-4">
      {/* Header with Sport Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Trophy size={20} className="text-amber-500" />
          <span>{t("prs.title")}</span>
        </h2>

        {/* Tab switch */}
        <div className="flex items-center gap-1 bg-[var(--color-surface-github)] p-1 rounded-xl border border-[var(--border)] text-xs">
          <button
            type="button"
            onClick={() => {
              haptics.light();
              setSportTab("running");
            }}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
              sportTab === "running"
                ? "bg-orange-500 text-white shadow"
                : "text-[var(--muted)] hover:text-white"
            }`}
          >
            <span>🏃</span>
            <span>{t("sport.running")}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              haptics.light();
              setSportTab("cycling");
            }}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
              sportTab === "cycling"
                ? "bg-amber-500 text-black font-black shadow"
                : "text-[var(--muted)] hover:text-white"
            }`}
          >
            <span>🚴</span>
            <span>{t("sport.cycling")}</span>
          </button>
        </div>
      </div>

      <div
        className={`grid grid-cols-2 ${
          sportTab === "cycling" ? "lg:grid-cols-3" : "lg:grid-cols-4"
        } gap-3 sm:gap-4`}
      >
        {displayedItems.map((item) => {
          const act = item.activity;
          const content = (
            <div className="flex flex-col h-full justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[var(--muted)] font-medium uppercase tracking-wider truncate mr-1">
                  {item.label}
                </span>
                <span className={`p-1.5 rounded-lg border ${item.bgClass} shrink-0`}>
                  {item.icon}
                </span>
              </div>
              <div className="mt-2">
                <p className="text-xl font-bold tracking-tight text-[var(--text)] font-mono">
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
                  <p className="text-[10px] text-[var(--muted)] mt-1">{t("common.no_data")}</p>
                )}
              </div>
            </div>
          );

          if (act) {
            return (
              <Link
                key={item.id}
                href={`/atividades/ver/?id=${act.id}`}
                className="block p-3.5 sm:p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--accent)] hover:shadow-sm transition-all duration-200"
              >
                {content}
              </Link>
            );
          }

          return (
            <div
              key={item.id}
              className="p-3.5 sm:p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)]/50 opacity-60"
            >
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
