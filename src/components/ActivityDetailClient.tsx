"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Flame, Heart, Mountain, Timer, Trophy } from "lucide-react";
import { useState, useEffect } from "react";
import { getUserProfile } from "@/lib/profile";
import { listActivities } from "@/lib/activities";
import { getPersonalRecords, getActivityPRs, type PRCategory } from "@/lib/prs";
import { useI18n } from "@/lib/i18n";
import { getAllStoredGear } from "@/lib/storage";
import { associateGearToActivity } from "@/lib/gear";
import type { Gear } from "@/lib/types";

const PR_CATEGORY_KEYS: Record<PRCategory, string> = {
  longestDistance: "prs.longest_distance",
  bestPace: "prs.best_pace",
  longestDuration: "prs.longest_duration",
  highestElevation: "prs.highest_elevation",
};

const ActivityMap = dynamic(
  () => import("@/components/ActivityMap").then((m) => m.ActivityMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="rounded-xl bg-[var(--surface)] border border-[var(--border)] animate-pulse"
        style={{ height: "360px" }}
      />
    ),
  }
);
import { DeleteActivityButton } from "@/components/DeleteActivityButton";
import { ActivityCharts } from "@/components/ActivityCharts";
import { ExportGpxButton } from "@/components/ExportGpxButton";
import { ActivitySplits } from "@/components/ActivitySplits";
import { useActivityDetail } from "@/hooks/useActivities";
import {
  formatDate,
  formatDistance,
  formatDuration,
  formatCalories,
  formatElevation,
  formatPace,
  sportLabel,
} from "@/lib/format";

export function ActivityDetailClient() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const { activity, loading, notFound } = useActivityDetail(id);
  const [prCategories, setPrCategories] = useState<PRCategory[]>([]);
  const { t, language } = useI18n();

  // Gear States
  const [allGears, setAllGears] = useState<Gear[]>([]);
  const [activityGearId, setActivityGearId] = useState<string>("");

  useEffect(() => {
    async function loadGears() {
      try {
        const gears = await getAllStoredGear();
        setAllGears(gears);
      } catch (err) {
        console.error("Error loading gears in activity detail:", err);
      }
    }
    loadGears();
  }, []);

  useEffect(() => {
    if (activity) {
      setActivityGearId(activity.gearId || "");
    }
  }, [activity]);

  async function handleGearChange(newGearId: string) {
    if (!activity) return;
    try {
      const targetId = newGearId || null;
      await associateGearToActivity(activity.id, targetId);
      setActivityGearId(newGearId);
      // Directly reload to compute and display fresh stats/wear
      window.location.reload();
    } catch (err) {
      console.error("Error updating activity gear association:", err);
    }
  }

  useEffect(() => {
    if (!activity) return;
    const activityId = activity.id;
    async function checkPR() {
      try {
        const [profile, allActivities] = await Promise.all([
          getUserProfile(),
          listActivities(1000),
        ]);
        const prs = getPersonalRecords(allActivities, profile);
        const { isPR, categories } = getActivityPRs(activityId, prs);
        if (isPR) {
          setPrCategories(categories);
        }
      } catch (err) {
        console.error("Erro ao verificar PR do treino:", err);
      }
    }
    checkPR();
  }, [activity]);

  if (!id || notFound) {
    return (
      <p className="text-[var(--muted)]">
        {t("detail.not_found")}{" "}
        <Link href="/atividades/" className="text-[var(--accent)]">
          {t("common.back")}
        </Link>
      </p>
    );
  }

  if (loading || !activity) {
    return <p className="text-[var(--muted)]">{t("detail.loading")}</p>;
  }

  const associatedGear = allGears.find((g) => g.id === activityGearId);
  const dropdownGears = allGears.filter((g) => g.status === "active" || g.id === activityGearId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/atividades/"
            className="text-sm text-[var(--muted)] hover:text-[var(--text)] flex items-center gap-1 mb-2"
          >
            <ArrowLeft size={14} />
            {t("common.back")}
          </Link>
          <h1 className="text-2xl font-bold">{activity.name}</h1>
          <p className="text-[var(--muted)]">
            {sportLabel(activity.sport, language)} · {formatDate(activity.startedAt, language)}
            {activity.source === "recorded"
              ? ` · ${t("activities.recorded_on")}`
              : activity.fileName && ` · ${activity.fileName}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <ExportGpxButton activity={activity} />
          <DeleteActivityButton id={activity.id} />
        </div>
      </div>

      {prCategories.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
          <Trophy className="text-amber-500 shrink-0" size={28} />
          <div>
            <p className="font-semibold text-base text-amber-500 flex items-center gap-1.5 animate-pulse">
              {t("prs.congrats_title")}
            </p>
            <p className="text-sm text-[var(--muted)] leading-normal mt-0.5">
              {t("prs.congrats_sub")}{" "}
              <strong className="font-semibold text-[var(--text)]">
                {prCategories.map((cat) => t(PR_CATEGORY_KEYS[cat])).join(", ")}
              </strong>
              .
            </p>
          </div>
        </div>
      )}

      <ActivityMap points={activity.points} height="360px" />

      <ActivityCharts activity={activity} />

      <ActivitySplits points={activity.points} />

      {/* Gear Selector Section */}
      <div className="stat-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center text-xl shrink-0">
            👟
          </span>
          <div>
            <h3 className="text-sm font-semibold text-[var(--muted)]">{t("detail.gear")}</h3>
            <p className="text-base font-bold">
              {associatedGear ? (
                <>
                  {associatedGear.name}
                  {associatedGear.brand && ` (${associatedGear.brand})`}
                </>
              ) : (
                t("detail.gear_none")
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={activityGearId}
            onChange={(e) => handleGearChange(e.target.value)}
            className="profile-input bg-[var(--bg)] text-[var(--text)] border-[var(--border)] text-sm py-1.5 px-3 max-w-[200px]"
          >
            <option value="">-- {t("detail.gear_select")} --</option>
            {dropdownGears.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} {g.brand ? `(${g.brand})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-sm text-[var(--muted)]">{t("detail.distance")}</p>
          <p className="text-xl font-bold text-[var(--accent)]">
            {formatDistance(activity.distanceM)}
          </p>
        </div>
        <div className="stat-card flex gap-2">
          <Timer className="text-[var(--muted)] shrink-0 mt-1" size={18} />
          <div>
            <p className="text-sm text-[var(--muted)]">{t("detail.duration")}</p>
            <p className="text-xl font-bold">
              {formatDuration(activity.durationSec)}
            </p>
          </div>
        </div>
        <div className="stat-card">
          <p className="text-sm text-[var(--muted)]">{t("detail.avg_pace")}</p>
          <p className="text-xl font-bold">
            {formatPace(activity.avgPaceSecKm)}
          </p>
        </div>
        <div className="stat-card flex gap-2">
          <Mountain className="text-[var(--muted)] shrink-0 mt-1" size={18} />
          <div>
            <p className="text-sm text-[var(--muted)]">{t("detail.elevation")}</p>
            <p className="text-xl font-bold">
              {formatElevation(activity.elevationGainM)}
            </p>
          </div>
        </div>
        <div className="stat-card flex gap-2">
          <Flame className="text-orange-400 shrink-0 mt-1" size={18} />
          <div>
            <p className="text-sm text-[var(--muted)]">{t("detail.calories")}</p>
            <p className="text-xl font-bold">
              {formatCalories(activity.calories)}
            </p>
            {activity.calories != null && activity.calories > 0 && (
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {activity.source === "fit" || activity.source === "gpx"
                  ? t("detail.calories_source_file")
                  : t("detail.calories_source_profile")}
              </p>
            )}
          </div>
        </div>
        {activity.avgHr != null && (
          <div className="stat-card flex gap-2">
            <Heart className="text-red-400 shrink-0 mt-1" size={18} />
            <div>
              <p className="text-sm text-[var(--muted)]">{t("detail.avg_max_hr")}</p>
              <p className="text-xl font-bold">
                {activity.avgHr}
                {activity.maxHr != null && ` / ${activity.maxHr}`} bpm
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
