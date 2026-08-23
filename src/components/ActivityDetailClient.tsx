"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Flame,
  Heart,
  Mountain,
  Timer,
  Trophy,
  Map as MapIcon,
  Box,
  Activity as ActivityIcon,
  Zap,
  Gauge,
} from "lucide-react";
import { useState, useEffect } from "react";
import { getUserProfile } from "@/lib/profile";
import { listActivities } from "@/lib/activities";
import { getPersonalRecords, getActivityPRs, type PRCategory } from "@/lib/prs";
import { calculateVO2MaxFromWorkout, classifyVO2Max } from "@/lib/vo2max";
import { useI18n } from "@/lib/i18n";
import { getAllStoredGear } from "@/lib/storage";
import { associateGearToActivity } from "@/lib/gear";
import type { Gear, UserProfile } from "@/lib/types";
import { PowerDurationCurve } from "@/components/PowerDurationCurve";

const PR_CATEGORY_KEYS: Record<PRCategory, string> = {
  longestDistance: "prs.longest_distance",
  bestPace: "prs.best_pace",
  longestDuration: "prs.longest_duration",
  highestElevation: "prs.highest_elevation",
  highestAvgSpeed: "prs.cycling_highest_avg_speed",
  maxSpeed: "prs.cycling_max_speed",
  bestPower: "prs.cycling_best_power",
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

const ActivityFlyover3D = dynamic(
  () => import("@/components/ActivityFlyover3D").then((m) => m.ActivityFlyover3D),
  {
    ssr: false,
    loading: () => (
      <div
        className="rounded-2xl bg-[#0b0e14] border border-[var(--border)] animate-pulse flex items-center justify-center text-sm text-[var(--muted)]"
        style={{ height: "440px" }}
      >
        Carregando visualização 3D...
      </div>
    ),
  }
);

import { DeleteActivityButton } from "@/components/DeleteActivityButton";
import { ActivityCharts } from "@/components/ActivityCharts";
import { ExportGpxButton } from "@/components/ExportGpxButton";
import { CorrectElevationButton } from "@/components/CorrectElevationButton";
import { MergeFitButton } from "@/components/MergeFitButton";
import { ActivitySplits } from "@/components/ActivitySplits";
import { SocialShareCardModal } from "@/components/SocialShareCardModal";
import { HeartRateZonesPanel } from "@/components/HeartRateZonesPanel";
import { PowerZonesPanel } from "@/components/PowerZonesPanel";
import { StructuredWorkoutReportCard } from "@/components/StructuredWorkoutReportCard";
import { useActivityDetail } from "@/hooks/useActivities";
import { firePRConfetti } from "@/lib/confetti";
import { haptics } from "@/lib/haptics";

import {
  formatDate,
  formatDistance,
  formatDuration,
  formatCalories,
  formatElevation,
  formatPace,
  formatSpeed,
  formatWatts,
  formatGrade,
  formatVam,
  formatSportSpeedOrPace,
  sportLabel,
} from "@/lib/format";

export function ActivityDetailClient() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const { activity, loading, notFound } = useActivityDetail(id);
  const [prCategories, setPrCategories] = useState<PRCategory[]>([]);
  const [view3D, setView3D] = useState(false);
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

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!activity) return;
    const activityId = activity.id;
    const activitySport = activity.sport;
    async function checkPR() {
      try {
        const [profile, allActivities] = await Promise.all([
          getUserProfile(),
          listActivities(1000),
        ]);
        if (profile) {
          setUserProfile(profile);
        }
        const prs = getPersonalRecords(allActivities, profile);
        const { isPR, categories } = getActivityPRs(activityId, prs, activitySport);
        if (isPR) {
          setPrCategories(categories);
          firePRConfetti();
        }
      } catch (err) {
        console.error("Erro ao verificar PR do treino:", err);
      }
    }
    checkPR();
  }, [activity]);

  const workoutVo2 =
    activity && activity.sport === "running"
      ? calculateVO2MaxFromWorkout(
          activity.distanceM,
          activity.movingTimeSec || activity.durationSec,
          activity.avgHr,
          userProfile?.maxHr
        )
      : null;

  const vo2Classification = workoutVo2
    ? classifyVO2Max(workoutVo2, userProfile?.age || 30)
    : null;

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

  const isCycling = activity.sport === "cycling";
  const associatedGear = allGears.find((g) => g.id === activityGearId);
  const dropdownGears = allGears.filter(
    (g) =>
      (g.status === "active" || g.id === activityGearId) &&
      (isCycling ? g.type === "bike" : (g.type || "shoes") === "shoes")
  );

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
          <SocialShareCardModal
            activity={activity}
            prBadgeText={
              prCategories.length > 0
                ? prCategories.map((cat) => t(PR_CATEGORY_KEYS[cat])).join(", ")
                : null
            }
          />
          <ExportGpxButton activity={activity} />
          {activity.points.length >= 2 && (
            <>
              <CorrectElevationButton activityId={activity.id} />
              <MergeFitButton activityId={activity.id} />
            </>
          )}
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

      {/* 2D vs 3D Map View Toggle */}
      {activity.points.length >= 2 && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex bg-[var(--surface)] border border-[var(--border)] p-1 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setView3D(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                !view3D
                  ? "bg-[var(--accent)] text-white shadow"
                  : "text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              <MapIcon size={14} />
              {t("detail.view_2d_btn")}
            </button>
            <button
              type="button"
              onClick={() => setView3D(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                view3D
                  ? "bg-[var(--accent)] text-white shadow"
                  : "text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              <Box size={14} />
              {t("detail.flyover_3d_btn")}
            </button>
          </div>
        </div>
      )}

      {view3D && activity.points.length >= 2 ? (
        <ActivityFlyover3D
          points={activity.points}
          activityName={activity.name}
          onClose={() => setView3D(false)}
        />
      ) : (
        <ActivityMap points={activity.points} height="360px" />
      )}

      <ActivityCharts activity={activity} />

      {activity.structuredWorkoutReport && (
        <StructuredWorkoutReportCard report={activity.structuredWorkoutReport} />
      )}

      <HeartRateZonesPanel activity={activity} />

      <PowerZonesPanel activity={activity} />

      {isCycling && (
        <PowerDurationCurve activity={activity} userProfile={userProfile} />
      )}

      <ActivitySplits points={activity.points} sport={activity.sport} />

      {/* Gear Selector Section */}
      <div className="stat-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center gap-3">
          <span
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${
              isCycling
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                : "bg-[var(--accent-soft)]"
            }`}
          >
            {isCycling ? "🚲" : "👟"}
          </span>
          <div>
            <h3 className="text-sm font-semibold text-[var(--muted)]">
              {isCycling ? "Bicicleta Utilizada" : t("detail.gear")}
            </h3>
            <p className="text-base font-bold text-white">
              {associatedGear ? (
                <>
                  {associatedGear.name}
                  {associatedGear.brand && ` (${associatedGear.brand})`}
                  {associatedGear.weightKg != null && (
                    <span className="text-xs text-amber-400 font-normal ml-2">
                      · {associatedGear.weightKg} kg
                    </span>
                  )}
                  {associatedGear.wheelSize && (
                    <span className="text-xs text-[var(--muted)] font-normal ml-1">
                      · {associatedGear.wheelSize}
                    </span>
                  )}
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
            className="profile-input bg-[var(--bg)] text-[var(--text)] border-[var(--border)] text-sm py-1.5 px-3 max-w-[220px]"
          >
            <option value="">
              -- {isCycling ? "Selecionar Bike" : t("detail.gear_select")} --
            </option>
            {dropdownGears.map((g) => (
              <option key={g.id} value={g.id}>
                {g.type === "bike" ? "🚲 " : "👟 "}
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
            <p className="text-sm text-[var(--muted)]">
              {activity.movingTimeSec && activity.durationSec > activity.movingTimeSec + 3
                ? t("auto_pause.moving_time")
                : t("detail.duration")}
            </p>
            <p className="text-xl font-bold">
              {formatDuration(activity.movingTimeSec || activity.durationSec)}
            </p>
            {activity.movingTimeSec && (activity.elapsedTimeSec || activity.durationSec) > activity.movingTimeSec + 3 && (
              <p className="text-xs text-[var(--muted)] mt-0.5 font-mono">
                {t("auto_pause.elapsed_time")}: {formatDuration(activity.elapsedTimeSec || activity.durationSec)}
              </p>
            )}
          </div>
        </div>
        <div className="stat-card">
          <p className="text-sm text-[var(--muted)]">
            {isCycling
              ? t("detail.avg_speed")
              : activity.movingTimeSec && activity.durationSec > activity.movingTimeSec + 3
              ? t("auto_pause.moving_pace")
              : t("detail.avg_pace")}
          </p>
          <p className="text-xl font-bold">
            {isCycling
              ? formatSpeed(
                  activity.avgSpeedKmh ??
                    (activity.avgPaceSecKm ? 3600 / activity.avgPaceSecKm : null)
                )
              : formatPace(activity.avgPaceSecKm)}
          </p>
          {isCycling && activity.maxSpeedKmh != null && (
            <p className="text-xs text-[var(--muted)] mt-0.5 font-mono">
              {t("detail.max_speed")}: {formatSpeed(activity.maxSpeedKmh)}
            </p>
          )}
          {!isCycling &&
            activity.movingTimeSec &&
            activity.distanceM > 0 &&
            (activity.elapsedTimeSec || activity.durationSec) > activity.movingTimeSec + 3 && (
              <p className="text-xs text-[var(--muted)] mt-0.5 font-mono">
                {t("auto_pause.total_pace")}: {formatPace(((activity.elapsedTimeSec || activity.durationSec) / activity.distanceM) * 1000)}
              </p>
            )}
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

        {/* Cycling Specific Cards: Power & VAM */}
        {isCycling && (
          <>
            <div className="stat-card flex gap-2 border-amber-500/20 bg-amber-500/5">
              <Zap className="text-amber-400 shrink-0 mt-1 fill-amber-400" size={18} />
              <div>
                <p className="text-sm text-amber-400 font-bold">{t("detail.avg_watts")}</p>
                <p className="text-xl font-bold text-amber-300">
                  {formatWatts(activity.avgWatts)}
                </p>
                <p className="text-xs text-[var(--muted)] mt-0.5 font-mono">
                  {activity.normalizedPowerWatts
                    ? `NP: ${formatWatts(activity.normalizedPowerWatts)}`
                    : activity.maxWatts
                    ? `Máx: ${formatWatts(activity.maxWatts)}`
                    : "Estimada por física"}
                </p>
              </div>
            </div>
            <div className="stat-card flex gap-2 border-emerald-500/20 bg-emerald-500/5">
              <Gauge className="text-emerald-400 shrink-0 mt-1" size={18} />
              <div>
                <p className="text-sm text-emerald-400 font-bold">{t("detail.vam")}</p>
                <p className="text-xl font-bold text-emerald-300">
                  {activity.vamMh ? formatVam(activity.vamMh) : "—"}
                </p>
                {activity.maxGradePercent != null && (
                  <p className="text-xs text-[var(--muted)] mt-0.5 font-mono">
                    {t("detail.max_grade")}: {formatGrade(activity.maxGradePercent)}
                  </p>
                )}
              </div>
            </div>
          </>
        )}

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
        {workoutVo2 && vo2Classification && (
          <div className="stat-card flex gap-2">
            <ActivityIcon className="shrink-0 mt-1" size={18} style={{ color: vo2Classification.color }} />
            <div>
              <p className="text-sm text-[var(--muted)]">{t("vo2max.workout_score")}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-bold font-mono" style={{ color: vo2Classification.color }}>
                  {workoutVo2.toFixed(1)}
                </p>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: vo2Classification.bgRgba, color: vo2Classification.color }}>
                  {t(vo2Classification.labelKey)}
                </span>
              </div>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {t("vo2max.unit")}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
