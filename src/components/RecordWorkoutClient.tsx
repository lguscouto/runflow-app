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
  Maximize2,
  Minimize2,
  Heart,
  Bluetooth,
} from "lucide-react";
import { useWorkoutRecorder } from "@/hooks/useWorkoutRecorder";
import { useWakeLock } from "@/hooks/useWakeLock";
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
  const [trainingMode, setTrainingMode] = useState(false);

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
    hrStatus,
    hrBpm,
    hrDeviceName,
    hrSupported,
    connectHr,
    disconnectHr,
  } = useWorkoutRecorder();

  // Keep screen awake while recording
  useWakeLock(status === "recording");

  // Exit training mode when workout ends/pauses
  useEffect(() => {
    if (!isActive) {
      setTrainingMode(false);
    }
  }, [isActive]);

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
    setTrainingMode(false);
    const id = await stop();
    if (id) {
      router.push(`/atividades/ver/?id=${id}`);
    }
  }

  function handleCancelActive() {
    if (
      isActive &&
      !confirm(t("record.discard_confirm"))
    ) {
      return;
    }
    setTrainingMode(false);
    reset();
    setConfirmStop(false);
  }

  // ─── TRAINING MODE (fullscreen dark overlay) ───────────────────────────────
  if (trainingMode && isActive) {
    const isPaused = status === "paused";
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{ background: "#050810" }}
      >
        {/* Top status bar */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <span
              className={`w-2 h-2 rounded-full ${
                isPaused ? "bg-amber-400" : "bg-emerald-400 animate-pulse"
              }`}
            />
            <span>
              {sportLabel(sport, language)} · {t("record.points_count", { count: points.length })}
              {isPaused && ` · ${t("record.paused")}`}
            </span>
          </div>
          {/* Exit training mode */}
          <button
            onClick={() => setTrainingMode(false)}
            className="flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--text)] transition-colors px-2 py-1 rounded-lg border border-[var(--border)] bg-white/5"
          >
            <Minimize2 size={12} />
            {t("record.mode_full")}
          </button>
        </div>

        {/* Main metrics — vertically centered */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          {/* Time */}
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest text-[var(--muted)] mb-2 font-semibold">
              {t("record.elapsed")}
            </p>
            <p
              className="font-bold tabular-nums leading-none"
              style={{
                fontSize: "clamp(3.5rem, 18vw, 6.5rem)",
                color: isPaused ? "#f59e0b" : "#ffffff",
                textShadow: isPaused ? "0 0 40px #f59e0b40" : "0 0 60px #ffffff20",
              }}
            >
              {formatDuration(stats.elapsedSec)}
            </p>
          </div>

          {/* Distance */}
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest text-[var(--muted)] mb-2 font-semibold">
              {t("detail.distance")}
            </p>
            <p
              className="font-bold tabular-nums leading-none"
              style={{
                fontSize: "clamp(2.8rem, 14vw, 5rem)",
                color: "var(--accent)",
                textShadow: "0 0 50px var(--accent)40",
              }}
            >
              {formatDistance(stats.distanceM)}
            </p>
          </div>

          {/* Pace row: current + average */}
          <div className="flex gap-8 justify-center">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-widest text-[var(--muted)] mb-1 font-semibold">
                {t("record.current_pace")}
              </p>
              <p
                className="font-bold tabular-nums"
                style={{ fontSize: "clamp(2rem, 10vw, 3.5rem)", color: "#f0f4f8" }}
              >
                {formatPace(stats.currentPaceSecKm)}
              </p>
            </div>
            <div
              className="w-px self-stretch"
              style={{ background: "var(--border)" }}
            />
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-widest text-[var(--muted)] mb-1 font-semibold">
                {t("detail.avg_pace")}
              </p>
              <p
                className="font-bold tabular-nums"
                style={{ fontSize: "clamp(2rem, 10vw, 3.5rem)", color: "#8b9bb4" }}
              >
                {formatPace(stats.avgPaceSecKm)}
              </p>
            </div>
          </div>

          {/* Calories & Heart Rate */}
          <div className="flex gap-8 justify-center items-center">
            {liveCalories != null && (
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-widest text-[var(--muted)] mb-1 font-semibold">
                  {t("detail.calories")}
                </p>
                <p
                  className="font-bold tabular-nums text-orange-400"
                  style={{ fontSize: "clamp(1.4rem, 6vw, 2rem)" }}
                >
                  {formatCalories(liveCalories)}
                </p>
              </div>
            )}
            {liveCalories != null && hrBpm !== null && (
              <div
                className="w-px h-8"
                style={{ background: "var(--border)" }}
              />
            )}
            {hrBpm !== null && (
              <div className="text-center flex flex-col items-center">
                <p className="text-[10px] uppercase tracking-widest text-[var(--muted)] mb-1 font-semibold flex items-center gap-1">
                  <Heart size={12} className="text-red-500 fill-red-500 animate-pulse" />
                  {t("record.hr_reading")}
                </p>
                <p
                  className="font-bold tabular-nums text-red-500"
                  style={{ fontSize: "clamp(1.4rem, 6vw, 2rem)" }}
                >
                  {hrBpm} <span className="text-xs text-[var(--muted)] font-semibold">BPM</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom action buttons */}
        <div className="px-5 pb-8 pt-4 flex flex-col gap-3">
          {status === "recording" && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={pause}
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base border border-[var(--border)] bg-white/5 text-[var(--text)] active:scale-95 transition-transform"
              >
                <Pause size={20} />
                {t("record.pause_btn")}
              </button>
              <button
                type="button"
                onClick={handleStop}
                className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base active:scale-95 transition-transform ${
                  confirmStop
                    ? "bg-red-600 text-white"
                    : "border border-[var(--border)] bg-white/5 text-[var(--text)]"
                }`}
              >
                <Square size={18} fill="currentColor" />
                {confirmStop ? t("record.confirm_stop_btn") : t("record.stop_btn")}
              </button>
            </div>
          )}

          {status === "paused" && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={resume}
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base bg-[var(--accent)] text-white active:scale-95 transition-transform"
              >
                <Play size={20} fill="currentColor" />
                {t("record.resume_btn")}
              </button>
              <button
                type="button"
                onClick={handleStop}
                className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base active:scale-95 transition-transform ${
                  confirmStop
                    ? "bg-red-600 text-white"
                    : "border border-[var(--border)] bg-white/5 text-[var(--text)]"
                }`}
              >
                <Square size={18} />
                {confirmStop ? t("common.confirm") : t("record.stop_btn")}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleCancelActive}
            className="text-sm text-[var(--muted)] hover:text-red-400 py-1 transition-colors"
          >
            {t("record.discard_btn")}
          </button>
        </div>
      </div>
    );
  }

  // ─── FULL VIEW (layout normal) ──────────────────────────────────────────────
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

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {isActive ? t("record.active_title") : t("record.title")}
          </h1>
          <p className="text-[var(--muted)] text-sm mt-1">
            {isActive ? t("record.active_sub") : t("record.inactive_sub")}
          </p>
        </div>

        {/* Training Mode toggle button — only when active */}
        {isActive && status !== "saving" && (
          <button
            onClick={() => setTrainingMode(true)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-semibold hover:bg-[var(--accent)]/20 transition-colors"
            title={t("record.mode_training")}
          >
            <Maximize2 size={13} />
            {t("record.mode_training")}
          </button>
        )}
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

            {hrBpm !== null && (
              <div className="stat-card text-center py-4 col-span-2 flex items-center justify-center gap-3 border border-red-500/20 bg-red-500/5 animate-pulse">
                <Heart size={20} className="text-red-400 fill-red-400 shrink-0" />
                <div className="text-left">
                  <p className="text-xs text-[var(--muted)]">{t("record.hr_reading")}</p>
                  <p className="text-xl font-bold text-red-400 tabular-nums">
                    {hrBpm} <span className="text-xs font-semibold text-[var(--muted)]">bpm</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
            <MapPin size={14} className="text-[var(--accent)]" />
            {t("record.points_count", { count: points.length })} · {sportLabel(sport, language)}
            {status === "paused" && ` · ${t("record.paused")}`}
          </div>
        </>
      )}

      {!isActive && status !== "saving" && (
        <div className="stat-card space-y-4 border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center gap-2">
            <Bluetooth size={18} className="text-[var(--accent)]" />
            <h3 className="text-sm font-semibold text-[var(--text)]">{t("record.hr_sensor")}</h3>
          </div>
          <p className="text-xs text-[var(--muted)] -mt-2">
            {t("record.hr_sensor_sub")}
          </p>

          {!hrSupported ? (
            <p className="text-xs text-amber-500/80 bg-amber-500/5 border border-amber-500/10 p-3 rounded-lg flex items-center gap-2">
              ⚠️ {t("record.hr_not_supported")}
            </p>
          ) : (
            <div className="flex items-center justify-between gap-3 p-1">
              {hrStatus === "disconnected" && (
                <button
                  type="button"
                  onClick={connectHr}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white/5 text-sm font-semibold text-[var(--text)] hover:bg-white/10 transition-colors"
                >
                  <Heart size={14} className="text-red-400 animate-pulse" />
                  {t("record.connect_hr")}
                </button>
              )}

              {hrStatus === "connecting" && (
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-white/5 text-sm font-semibold text-[var(--muted)]"
                >
                  <Loader2 size={14} className="animate-spin" />
                  {t("record.connecting_hr")}
                </button>
              )}

              {hrStatus === "connected" && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    <div className="text-left">
                      <p className="text-sm font-bold text-[var(--text)] leading-tight">
                        {hrDeviceName}
                      </p>
                      <p className="text-xs text-red-400 font-semibold flex items-center gap-1 mt-0.5">
                        <Heart size={10} className="fill-red-400 animate-pulse" />
                        {hrBpm !== null ? `${hrBpm} BPM` : "--- BPM"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={disconnectHr}
                    className="text-xs font-semibold text-red-400 hover:text-red-300 border border-red-500/20 bg-red-500/5 px-3 py-1.5 rounded-lg transition-colors self-start sm:self-center"
                  >
                    {t("record.disconnect_hr")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
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
            {language === "en"
              ? `Start ${sportLabel(sport, language).toLowerCase()}`
              : `Iniciar ${sportLabel(sport, language).toLowerCase()}`}
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
