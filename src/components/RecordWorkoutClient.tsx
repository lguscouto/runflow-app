"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Pause,
  Play,
  Square,
  MapPin,
  Loader2,
} from "lucide-react";
import { useWorkoutRecorder } from "@/hooks/useWorkoutRecorder";
import { estimateActivityCalories } from "@/lib/calories";
import { getUserProfile } from "@/lib/profile";
import {
  formatCalories,
  formatDistance,
  formatDuration,
  formatPace,
  sportLabel,
} from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { Sport } from "@/lib/types";

const LiveMapTrack = dynamic(
  () => import("@/components/LiveMapTrack").then((m) => m.LiveMapTrack),
  {
    ssr: false,
    loading: () => (
      <div
        className="rounded-xl bg-[var(--surface)] border border-[var(--border)] animate-pulse flex items-center justify-center text-[var(--muted)] text-sm"
        style={{ height: "280px" }}
      >
        Carregando mapa / Loading map...
      </div>
    ),
  }
);

const SPORTS: Sport[] = ["running", "walking", "cycling"];

export function RecordWorkoutClient() {
  const router = useRouter();
  const { t, language } = useI18n();
  const [confirmStop, setConfirmStop] = useState(false);
  const [liveCalories, setLiveCalories] = useState<number | null>(null);
  const {
    status,
    sport,
    setSport,
    points,
    stats,
    error,
    setError,
    start,
    pause,
    resume,
    stop,
    reset,
    isActive,
  } = useWorkoutRecorder();

  useEffect(() => {
    if (!isActive) {
      setLiveCalories(null);
      return;
    }
    getUserProfile().then((profile) => {
      setLiveCalories(
        estimateActivityCalories(profile, {
          sport,
          durationSec: stats.elapsedSec,
          distanceM: stats.distanceM,
          avgPaceSecKm: stats.avgPaceSecKm,
        })
      );
    });
  }, [
    isActive,
    sport,
    stats.elapsedSec,
    stats.distanceM,
    stats.avgPaceSecKm,
  ]);

  async function handleStart() {
    setConfirmStop(false);
    await start();
  }

  async function handleStop() {
    if (!confirmStop) {
      setConfirmStop(true);
      return;
    }
    const id = await stop();
    if (id) {
      router.push(`/atividades/ver/?id=${id}`);
    }
  }

  function handleCancelActive() {
    if (
      isActive &&
      !confirm(
        t("record.discard_confirm")
      )
    ) {
      return;
    }
    reset();
    setConfirmStop(false);
  }

  return (
    <div className="space-y-6 -mt-2">
      {!isActive && (
        <Link
          href="/"
          className="text-sm text-[var(--muted)] hover:text-[var(--text)] inline-flex items-center gap-1"
        >
          <ArrowLeft size={14} />
          {t("common.back")}
        </Link>
      )}

      <div>
        <h1 className="text-2xl font-bold">
          {isActive ? t("record.active_title") : t("record.title")}
        </h1>
        <p className="text-[var(--muted)] text-sm mt-1">
          {isActive
            ? t("record.active_sub")
            : t("record.inactive_sub")}
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-300 text-sm">
          {error}
          <button
            type="button"
            className="block mt-2 underline"
            onClick={() => setError(null)}
          >
            {t("record.close")}
          </button>
        </div>
      )}

      {isActive && (
        <>
          <LiveMapTrack points={points} follow={status === "recording"} />

          <div className="grid grid-cols-2 gap-3">
            <div className="stat-card text-center py-5">
              <p className="text-xs text-[var(--muted)] uppercase tracking-wide">
                {t("record.time")}
              </p>
              <p className="text-3xl font-bold tabular-nums mt-1">
                {formatDuration(stats.elapsedSec)}
              </p>
            </div>
            <div className="stat-card text-center py-5">
              <p className="text-xs text-[var(--muted)] uppercase tracking-wide">
                {t("detail.distance")}
              </p>
              <p className="text-3xl font-bold tabular-nums mt-1 text-[var(--accent)]">
                {formatDistance(stats.distanceM)}
              </p>
            </div>
            <div className="stat-card text-center py-4">
              <p className="text-xs text-[var(--muted)]">{t("record.current_pace")}</p>
              <p className="text-xl font-semibold mt-1">
                {formatPace(stats.currentPaceSecKm)}
              </p>
            </div>
            <div className="stat-card text-center py-4">
              <p className="text-xs text-[var(--muted)]">{t("detail.avg_pace")}</p>
              <p className="text-xl font-semibold mt-1">
                {formatPace(stats.avgPaceSecKm)}
              </p>
            </div>
            <div className="stat-card text-center py-4 col-span-2">
              <p className="text-xs text-[var(--muted)]">
                {t("detail.calories")} ({t("detail.calories_source_profile").toLowerCase()})
              </p>
              <p className="text-xl font-semibold mt-1 text-orange-400">
                {liveCalories != null ? formatCalories(liveCalories) : "—"}
              </p>
              {liveCalories == null && (
                <Link
                  href="/perfil/"
                  className="text-xs text-[var(--accent)] mt-1 inline-block"
                >
                  {t("detail.kcal_sub")}
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
            <MapPin size={14} className="text-[var(--accent)]" />
            {t("record.points_count", { count: points.length })} · {sportLabel(sport, language)}
            {status === "paused" && ` · ${t("record.paused")}`}
          </div>
        </>
      )}

      {!isActive && status !== "saving" && (
        <div className="stat-card space-y-4">
          <p className="text-sm text-[var(--muted)]">{t("record.activity_type")}</p>
          <div className="flex flex-wrap gap-2">
            {SPORTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSport(s)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  sport === s
                    ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                    : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--muted)]"
                }`}
              >
                {sportLabel(s, language)}
              </button>
            ))}
          </div>
          <ul className="text-xs text-[var(--muted)] space-y-1 list-disc list-inside">
            <li>{t("record.guide_gps")}</li>
            <li>{t("record.guide_permission")}</li>
            <li>
              <Link href="/perfil/" className="text-[var(--accent)] hover:underline">
                {t("nav.profile")}
              </Link>{" "}
              {language === "en" ? "with weight to estimate calories" : "com peso para estimar calorias"}
            </li>
            <li>{t("record.guide_min")}</li>
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3 pb-4">
        {status === "idle" && (
          <button
            type="button"
            className="btn-primary w-full justify-center py-4 text-lg"
            onClick={handleStart}
          >
            <Play size={22} fill="currentColor" />
            {language === "en" ? `Start ${sportLabel(sport, language).toLowerCase()}` : `Iniciar ${sportLabel(sport, language).toLowerCase()}`}
          </button>
        )}

        {status === "recording" && (
          <div className="flex gap-3">
            <button
              type="button"
              className="btn-ghost flex-1 justify-center py-4"
              onClick={pause}
            >
              <Pause size={22} />
              {t("record.pause_btn")}
            </button>
            <button
              type="button"
              className={`flex-1 justify-center py-4 rounded-lg font-semibold flex items-center gap-2 ${
                confirmStop
                  ? "bg-red-600 text-white"
                  : "bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
              }`}
              onClick={handleStop}
            >
              <Square size={20} fill="currentColor" />
              {confirmStop ? t("record.confirm_stop_btn") : t("record.stop_btn")}
            </button>
          </div>
        )}

        {status === "paused" && (
          <div className="flex gap-3">
            <button
              type="button"
              className="btn-primary flex-1 justify-center py-4"
              onClick={resume}
            >
              <Play size={22} fill="currentColor" />
              {t("record.resume_btn")}
            </button>
            <button
              type="button"
              className={`flex-1 justify-center py-4 rounded-lg font-semibold flex items-center gap-2 ${
                confirmStop
                  ? "bg-red-600 text-white"
                  : "border border-[var(--border)]"
              }`}
              onClick={handleStop}
            >
              <Square size={20} />
              {confirmStop ? t("common.confirm") : t("record.stop_btn")}
            </button>
          </div>
        )}

        {status === "saving" && (
          <div className="btn-primary w-full justify-center py-4 opacity-80">
            <Loader2 size={22} className="animate-spin" />
            {t("record.saving_workout")}
          </div>
        )}

        {isActive && status !== "saving" && (
          <button
            type="button"
            className="text-sm text-[var(--muted)] hover:text-red-400"
            onClick={handleCancelActive}
          >
            {t("record.discard_btn")}
          </button>
        )}
      </div>
    </div>
  );
}
