"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
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
  Ghost,
  Volume2,
  VolumeX,
  Route,
  MapPinned,
  Mic,
  Headphones,
  PauseCircle,
  Zap,
} from "lucide-react";
import { VoiceCoachModal } from "@/components/VoiceCoachModal";
import { AutoPauseModal } from "@/components/AutoPauseModal";
import { WorkoutLibraryModal } from "@/components/WorkoutLibraryModal";
import { StructuredWorkoutHud } from "@/components/StructuredWorkoutHud";
import { useWorkoutRecorder } from "@/hooks/useWorkoutRecorder";
import { useWakeLock } from "@/hooks/useWakeLock";
import { estimateActivityCalories } from "@/lib/calories";
import { getUserProfile } from "@/lib/profile";
import { listActivities } from "@/lib/activities";
import { calculateHrZones, getCurrentHrZone } from "@/lib/hr-zones";
import {
  formatCalories,
  formatDistance,
  formatDuration,
  formatPace,
  sportLabel,
} from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { Sport, UserProfile, ActivitySummary, GhostConfig, SavedRoute, StructuredWorkout } from "@/lib/types";
import { getAllStoredRoutes } from "@/lib/storage";

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
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Load user profile on mount
  useEffect(() => {
    getUserProfile().then((p) => {
      setProfile(p);
    });
  }, []);

  // Ghost Runner configuration states
  const [ghostMode, setGhostMode] = useState<"disabled" | "pace" | "activity">("disabled");
  const [targetPaceMin, setTargetPaceMin] = useState<number>(5);
  const [targetPaceSec, setTargetPaceSec] = useState<number>(0);
  const [selectedActivityId, setSelectedActivityId] = useState<string>("");
  const [audioAlerts, setAudioAlerts] = useState<boolean>(true);
  const [audioFreq, setAudioFreq] = useState<"1km" | "2min" | "5min">("1km");
  const [pastActivities, setPastActivities] = useState<ActivitySummary[]>([]);
  const [allRoutes, setAllRoutes] = useState<SavedRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [routeTolerance, setRouteTolerance] = useState<number>(50);
  const [routeVoiceAlerts, setRouteVoiceAlerts] = useState<boolean>(true);
  const [isVoiceCoachModalOpen, setIsVoiceCoachModalOpen] = useState(false);
  const [isAutoPauseModalOpen, setIsAutoPauseModalOpen] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<StructuredWorkout | null>(null);
  const [isWorkoutLibraryModalOpen, setIsWorkoutLibraryModalOpen] = useState(false);

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
    ghostConfig,
    ghostStats,
    voiceCoachConfig,
    updateVoiceCoachConfig,
    autoPauseConfig,
    updateAutoPauseConfig,
    isAutoPaused,
    structuredWorkout,
    flatSteps,
    currentStepIndex,
    currentWorkoutStep,
    nextWorkoutStep,
    stepElapsedSec,
    stepDistanceM,
    setStructuredWorkout,
    skipStructuredWorkoutStep,
  } = useWorkoutRecorder();

  const userHrZones = useMemo(() => {
    return calculateHrZones(profile || undefined);
  }, [profile]);

  const currentZone = useMemo(() => {
    return getCurrentHrZone(hrBpm, userHrZones);
  }, [hrBpm, userHrZones]);

  // Fetch past activities for selector when idle
  useEffect(() => {
    if (status === "idle") {
      listActivities(50).then((acts) => {
        const filtered = acts.filter((a) => a.sport === sport);
        setPastActivities(filtered);
        if (filtered.length > 0) {
          setSelectedActivityId(filtered[0].id);
        } else {
          setSelectedActivityId("");
        }
      });
    }
  }, [status, sport]);

  // Load saved routes on mount
  useEffect(() => {
    getAllStoredRoutes().then(setAllRoutes);
  }, []);

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
    setLiveCalories(
      estimateActivityCalories(profile, {
        sport,
        durationSec: stats.elapsedSec,
        distanceM: stats.distanceM,
        avgPaceSecKm: stats.avgPaceSecKm,
      })
    );
  }, [
    isActive,
    sport,
    stats.elapsedSec,
    stats.distanceM,
    stats.avgPaceSecKm,
    profile,
  ]);

  async function handleStart() {
    setConfirmStop(false);
    const gConfig: GhostConfig = {
      mode: ghostMode,
      audioAlerts,
      audioFreq,
    };
    if (ghostMode === "pace") {
      const paceSec = targetPaceMin * 60 + targetPaceSec;
      gConfig.targetPaceSecKm = paceSec > 0 ? paceSec : 300;
    } else if (ghostMode === "activity") {
      gConfig.activityId = selectedActivityId || null;
    }
    if (selectedRouteId && allRoutes.length > 0) {
      gConfig.routeId = selectedRouteId;
    }
    await start(gConfig, selectedWorkout);
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

  const renderGhostComparison = (isFullscreen: boolean) => {
    if (!ghostConfig || ghostConfig.mode === "disabled" || !ghostStats) return null;

    const userDist = stats.distanceM;
    const ghostDist = ghostStats.distanceM;
    const maxDist = Math.max(userDist, ghostDist, 100);
    const userPercent = (userDist / maxDist) * 100;
    const ghostPercent = (ghostDist / maxDist) * 100;

    const isAhead = ghostStats.status === "ahead";
    const isBehind = ghostStats.status === "behind";
    
    // Status text and color
    let statusBg = "bg-white/5 border-white/10";
    let statusTextColor = "text-[var(--text)]";
    let diffText = "";
    
    if (isAhead) {
      statusBg = "bg-emerald-500/10 border-emerald-500/20";
      statusTextColor = "text-emerald-400";
      diffText = `+${Math.round(ghostStats.diffM)} m`;
    } else if (isBehind) {
      statusBg = "bg-rose-500/10 border-rose-500/20";
      statusTextColor = "text-rose-400";
      diffText = `${Math.round(ghostStats.diffM)} m`;
    } else {
      statusBg = "bg-blue-500/10 border-blue-500/20";
      statusTextColor = "text-blue-400";
      diffText = t("record.ghost_audio_alert_tied").replace(".", "");
    }

    if (isFullscreen) {
      return (
        <div className="w-full max-w-md mx-auto px-6 py-3 border border-white/5 bg-white/[0.01] backdrop-blur-md rounded-2xl space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-[var(--muted)]">
              <Ghost className="w-4 h-4 text-[var(--accent)] animate-pulse" />
              <span>
                {ghostConfig.mode === "pace"
                  ? `${t("record.ghost_target_pace_label")}: ${formatPace(ghostConfig.targetPaceSecKm)}/km`
                  : t("record.ghost_past_activity")}
              </span>
            </div>
            <div className={`px-2 py-0.5 rounded-full border font-bold tabular-nums ${statusBg} ${statusTextColor}`}>
              {diffText} {isAhead ? t("record.ghost_ahead") : isBehind ? t("record.ghost_behind") : ""}
            </div>
          </div>

          {/* Simple sleek comparative slider */}
          <div className="relative pt-4 pb-1">
            <div className="h-1.5 w-full rounded-full bg-white/5 relative">
              <div 
                className="absolute left-0 top-0 bottom-0 bg-[var(--accent)] rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${userPercent}%` }}
              />
            </div>
            {/* Ghost Icon */}
            <span 
              className="absolute top-0 text-sm transform -translate-x-1/2 transition-all duration-500 ease-out leading-none"
              style={{ left: `${ghostPercent}%` }}
            >
              👻
            </span>
            {/* User Icon */}
            <span 
              className="absolute top-0 text-sm transform -translate-x-1/2 transition-all duration-300 ease-out leading-none z-10"
              style={{ left: `${userPercent}%` }}
            >
              🏃‍♂️
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="stat-card border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ghost className="w-5 h-5 text-[var(--accent)] animate-bounce" style={{ animationDuration: '3s' }} />
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                {t("record.ghost_status")}
              </h4>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {ghostConfig.mode === "pace"
                  ? `${t("record.ghost_target_pace_label")}: ${formatPace(ghostConfig.targetPaceSecKm)}/km`
                  : t("record.ghost_past_activity")}
              </p>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full border text-sm font-bold tabular-nums flex items-center gap-1 ${statusBg} ${statusTextColor}`}>
            {isAhead && "🏃‍♂️"}
            {isBehind && "👻"}
            <span>{diffText}</span>
            <span className="text-[10px] uppercase font-normal text-[var(--muted)] ml-1">
              {isAhead ? t("record.ghost_ahead") : isBehind ? t("record.ghost_behind") : ""}
            </span>
          </div>
        </div>

        {/* Comparative Race Track */}
        <div className="relative pt-6 pb-2 px-1">
          {/* Track line */}
          <div className="h-2 w-full rounded-full bg-white/5 border border-white/[0.08] relative overflow-hidden">
            {/* User progress gradient */}
            <div 
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-[var(--accent)]/20 to-[var(--accent)] transition-all duration-300 ease-out" 
              style={{ width: `${userPercent}%` }}
            />
          </div>

          {/* Ghost Runner Marker */}
          <div 
            className="absolute top-0 transform -translate-x-1/2 transition-all duration-500 ease-out flex flex-col items-center group"
            style={{ left: `${ghostPercent}%` }}
          >
            <div className="bg-white/10 border border-white/20 text-[10px] px-1.5 py-0.5 rounded shadow-lg backdrop-blur-sm scale-90 opacity-75 group-hover:opacity-100 group-hover:scale-100 transition-all text-white">
              👻 {formatDistance(ghostDist)}
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-white border border-white shadow-md shadow-white/40 mt-1" />
          </div>

          {/* User Marker */}
          <div 
            className="absolute top-0 transform -translate-x-1/2 transition-all duration-300 ease-out flex flex-col items-center z-10 group"
            style={{ left: `${userPercent}%` }}
          >
            <div className="bg-[var(--accent-soft)] border border-[var(--accent)]/30 text-[10px] px-1.5 py-0.5 rounded shadow-lg backdrop-blur-sm text-[var(--accent)] font-semibold scale-90 group-hover:scale-100 transition-all">
              🏃‍♂️ {formatDistance(userDist)}
            </div>
            <div className="w-3.5 h-3.5 rounded-full bg-[var(--accent)] border border-white shadow-lg shadow-[var(--accent)]/40 mt-0.5 animate-pulse" />
          </div>
        </div>
      </div>
    );
  };

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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAutoPauseModalOpen(true)}
              className={`flex items-center gap-1.5 text-xs transition-colors px-2.5 py-1 rounded-lg border ${
                autoPauseConfig.enabled
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                  : "border-[var(--border)] bg-white/5 text-[var(--muted)] hover:text-white"
              }`}
              title={t("auto_pause.title")}
            >
              <PauseCircle size={13} />
              <span>{autoPauseConfig.enabled ? t("auto_pause.quick_btn") : "Auto-Pause Off"}</span>
            </button>
            <button
              onClick={() => setIsVoiceCoachModalOpen(true)}
              className={`flex items-center gap-1.5 text-xs transition-colors px-2.5 py-1 rounded-lg border ${
                voiceCoachConfig.enabled
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : "border-[var(--border)] bg-white/5 text-[var(--muted)] hover:text-white"
              }`}
              title={t("voice_coach.title")}
            >
              <Headphones size={13} />
              <span>{voiceCoachConfig.enabled ? t("voice_coach.quick_btn") : "Voz Off"}</span>
            </button>
            <button
              onClick={() => setTrainingMode(false)}
              className="flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--text)] transition-colors px-2 py-1 rounded-lg border border-[var(--border)] bg-white/5"
            >
              <Minimize2 size={12} />
              {t("record.mode_full")}
            </button>
          </div>
        </div>

        {/* Auto-Paused Banner in Training Mode */}
        {stats.isAutoPaused && !isPaused && (
          <div className="mx-6 mt-1 py-1.5 px-3 rounded-xl border border-amber-500/40 bg-amber-500/15 text-amber-300 font-bold text-xs flex items-center justify-center gap-2 animate-pulse">
            <PauseCircle size={15} />
            <span>{t("auto_pause.badge_paused")} (&lt; {autoPauseConfig.minSpeedKmh} km/h)</span>
          </div>
        )}

        {/* Main metrics — vertically centered */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          {/* Time */}
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest text-[var(--muted)] mb-2 font-semibold flex items-center justify-center gap-1">
              <span>{t("auto_pause.moving_time")}</span>
            </p>
            <p
              className="font-bold tabular-nums leading-none"
              style={{
                fontSize: "clamp(3.5rem, 18vw, 6.5rem)",
                color: isPaused || stats.isAutoPaused ? "#f59e0b" : "#ffffff",
                textShadow: isPaused || stats.isAutoPaused ? "0 0 40px #f59e0b40" : "0 0 60px #ffffff20",
              }}
            >
              {formatDuration(stats.movingSec || stats.elapsedSec)}
            </p>
            {stats.elapsedSec > (stats.movingSec || 0) + 2 && (
              <p className="text-xs text-[var(--muted)] mt-1.5 font-mono">
                {t("auto_pause.elapsed_time")}: {formatDuration(stats.elapsedSec)}
              </p>
            )}
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
                {currentZone && (
                  <span
                    style={{
                      backgroundColor: currentZone.bgRgba,
                      color: currentZone.color,
                      borderColor: currentZone.color,
                    }}
                    className="mt-1 px-2 py-0.5 rounded-full border text-[10px] font-black"
                  >
                    Z{currentZone.zone} • {t(currentZone.nameKey)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Structured Workout HUD in Fullscreen */}
        {currentWorkoutStep && (
          <div className="px-5">
            <StructuredWorkoutHud
              currentStep={currentWorkoutStep}
              nextStep={nextWorkoutStep}
              workoutName={structuredWorkout?.name || t("workout.hud_badge")}
              stepElapsedSec={stepElapsedSec}
              stepDistanceM={stepDistanceM}
              currentPaceSecKm={stats.currentPaceSecKm}
              onSkipStep={skipStructuredWorkoutStep}
            />
          </div>
        )}

        {/* Ghost Runner comparison if active */}
        {renderGhostComparison(true)}

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

        <VoiceCoachModal
          config={voiceCoachConfig}
          isOpen={isVoiceCoachModalOpen}
          onClose={() => setIsVoiceCoachModalOpen(false)}
          onSave={updateVoiceCoachConfig}
        />

        <AutoPauseModal
          config={autoPauseConfig}
          isOpen={isAutoPauseModalOpen}
          onClose={() => setIsAutoPauseModalOpen(false)}
          onSave={updateAutoPauseConfig}
        />
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

        <div className="flex items-center gap-2">
          {/* Auto-Pause Button */}
          <button
            type="button"
            onClick={() => setIsAutoPauseModalOpen(true)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
              autoPauseConfig.enabled
                ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]"
            }`}
            title={t("auto_pause.title")}
          >
            <PauseCircle size={14} />
            <span>{autoPauseConfig.enabled ? t("auto_pause.quick_btn") : "Auto-Pause Off"}</span>
          </button>

          {/* Voice Coach Button */}
          <button
            type="button"
            onClick={() => setIsVoiceCoachModalOpen(true)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
              voiceCoachConfig.enabled
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]"
            }`}
            title={t("voice_coach.title")}
          >
            <Headphones size={14} />
            <span>{voiceCoachConfig.enabled ? t("voice_coach.quick_btn") : "Voz Off"}</span>
          </button>

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

      {/* Auto-Paused Banner during active recording */}
      {isActive && stats.isAutoPaused && status === "recording" && (
        <div className="flex items-center justify-center gap-2 p-3 rounded-xl border border-amber-500/40 bg-amber-500/15 text-amber-300 font-bold text-sm animate-pulse shadow-lg shadow-amber-500/10">
          <PauseCircle size={18} />
          <span>{t("auto_pause.badge_paused")} — Ritmo pausado automaticamente (&lt; {autoPauseConfig.minSpeedKmh} km/h)</span>
        </div>
      )}

      {isActive && (
        <>
          {currentWorkoutStep && (
            <StructuredWorkoutHud
              currentStep={currentWorkoutStep}
              nextStep={nextWorkoutStep}
              workoutName={structuredWorkout?.name || t("workout.hud_badge")}
              stepElapsedSec={stepElapsedSec}
              stepDistanceM={stepDistanceM}
              currentPaceSecKm={stats.currentPaceSecKm}
              onSkipStep={skipStructuredWorkoutStep}
            />
          )}

          <LiveMapTrack points={points} follow={status === "recording"} />

          {renderGhostComparison(false)}

          <div className="grid grid-cols-2 gap-3">
            <div className="stat-card text-center py-5">
              <p className="text-xs text-[var(--muted)] uppercase tracking-wide">
                {t("auto_pause.moving_time")}
              </p>
              <p className="text-3xl font-bold tabular-nums mt-1">
                {formatDuration(stats.movingSec || stats.elapsedSec)}
              </p>
              {stats.elapsedSec > (stats.movingSec || 0) + 2 && (
                <p className="text-[11px] text-[var(--muted)] mt-1 font-mono">
                  {t("auto_pause.elapsed_time")}: {formatDuration(stats.elapsedSec)}
                </p>
              )}
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
              <p className="text-xs text-[var(--muted)]">{t("auto_pause.moving_pace")}</p>
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
              <div className="stat-card text-center py-4 col-span-2 flex items-center justify-between px-5 border border-rose-500/20 bg-rose-500/5">
                <div className="flex items-center gap-3">
                  <Heart size={22} className="text-rose-500 fill-rose-500 animate-pulse shrink-0" />
                  <div className="text-left">
                    <p className="text-xs text-[var(--muted)]">{t("record.hr_reading")}</p>
                    <p className="text-xl font-bold text-rose-500 tabular-nums">
                      {hrBpm} <span className="text-xs font-semibold text-[var(--muted)]">bpm</span>
                    </p>
                  </div>
                </div>
                {currentZone && (
                  <div className="text-right">
                    <span
                      style={{
                        backgroundColor: currentZone.bgRgba,
                        color: currentZone.color,
                        borderColor: currentZone.color,
                      }}
                      className="px-2.5 py-1 rounded-lg border text-xs font-bold inline-block"
                    >
                      Z{currentZone.zone} • {t(currentZone.nameKey)}
                    </span>
                    <p className="text-[10px] text-[var(--muted)] mt-0.5 max-w-[150px] truncate">
                      {t(currentZone.descKey)}
                    </p>
                  </div>
                )}
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
        <div className="stat-card space-y-3 border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
                <Zap size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)]">
                  {t("workout.select_workout")}
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  {selectedWorkout ? selectedWorkout.name : t("workout.none")}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsWorkoutLibraryModalOpen(true)}
              className="btn-ghost text-xs px-3 py-1.5 border-orange-500/30 hover:border-orange-500 text-orange-400 font-semibold flex items-center gap-1"
            >
              <span>{selectedWorkout ? (language === "pt" ? "Alterar" : "Change") : t("workout.library_title")}</span>
            </button>
          </div>

          {selectedWorkout && (
            <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/25 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <p className="font-bold text-white">{selectedWorkout.name}</p>
                {selectedWorkout.description && (
                  <p className="text-[11px] text-[var(--muted)] line-clamp-1">
                    {selectedWorkout.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedWorkout(null);
                  setStructuredWorkout(null);
                }}
                className="text-xs text-[var(--muted)] hover:text-rose-400 underline ml-2"
              >
                {t("common.cancel")}
              </button>
            </div>
          )}
        </div>
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

      {/* Route Navigation Section */}
      {!isActive && status !== "saving" && (
        <div className="stat-card space-y-4 border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center gap-2">
            <MapPinned size={18} className="text-[var(--accent)]" />
            <h3 className="text-sm font-semibold text-[var(--text)]">{t("navigation.title")}</h3>
          </div>

          {allRoutes.length === 0 ? (
            <p className="text-xs text-[var(--muted)] flex items-center gap-1.5">
              <Route size={14} />
              {t("navigation.no_routes")}{" "}
              <Link href="/rotas/" className="text-[var(--accent)] hover:underline">
                {t("routes.create_btn")}
              </Link>
            </p>
          ) : (
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
                  {t("navigation.select_route")}
                </label>
                <select
                  value={selectedRouteId}
                  onChange={(e) => setSelectedRouteId(e.target.value)}
                  className="w-full text-sm rounded-lg bg-[var(--background)] border border-[var(--border)] text-[var(--text)] px-3 py-2 outline-none focus:border-[var(--accent)] transition-colors font-semibold"
                >
                  <option value="">{language === "en" ? "No route selected" : "Nenhuma rota selecionada"}</option>
                  {allRoutes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.name} ({(route.distanceM / 1000).toFixed(1)} km)
                    </option>
                  ))}
                </select>
              </div>

              {selectedRouteId && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">
                      {t("navigation.off_route_tolerance")}: {routeTolerance}m
                    </label>
                    <input
                      type="range"
                      min={25}
                      max={200}
                      step={25}
                      value={routeTolerance}
                      onChange={(e) => setRouteTolerance(Number(e.target.value))}
                      className="w-full accent-[var(--accent)]"
                    />
                    <div className="flex justify-between text-[10px] text-[var(--muted)] mt-0.5">
                      <span>{t("navigation.tolerance_25m")}</span>
                      <span>{t("navigation.tolerance_50m")}</span>
                      <span>{t("navigation.tolerance_100m")}</span>
                      <span>{t("navigation.tolerance_200m")}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {routeVoiceAlerts ? (
                        <Mic size={14} className="text-[var(--accent)]" />
                      ) : (
                        <Mic size={14} className="text-[var(--muted)]" />
                      )}
                      <span className="text-xs font-semibold text-[var(--text)]">
                        {t("navigation.voice_alerts")}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRouteVoiceAlerts(!routeVoiceAlerts)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                        routeVoiceAlerts ? "bg-[var(--accent)]" : "bg-white/10"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          routeVoiceAlerts ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {!isActive && status !== "saving" && (
        <div className="stat-card space-y-4 border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center gap-2">
            <Ghost size={18} className="text-[var(--accent)]" />
            <h3 className="text-sm font-semibold text-[var(--text)]">{t("record.ghost_runner")}</h3>
          </div>
          <p className="text-xs text-[var(--muted)] -mt-2">
            {language === "en"
              ? "Compete against a target pace or a past activity from your history with voice alerts."
              : "Compita contra um ritmo alvo ou uma atividade anterior do seu histórico com alertas de voz."}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
                {language === "en" ? "Mode" : "Modo"}
              </label>
              <select
                value={ghostMode}
                onChange={(e) => setGhostMode(e.target.value as any)}
                className="w-full text-sm rounded-lg bg-[var(--background)] border border-[var(--border)] text-[var(--text)] px-3 py-2 outline-none focus:border-[var(--accent)] transition-colors font-semibold"
              >
                <option value="disabled">{t("record.ghost_disabled")}</option>
                <option value="pace">{t("record.ghost_target_pace")}</option>
                <option value="activity">{t("record.ghost_past_activity")}</option>
              </select>
            </div>

            {ghostMode === "pace" && (
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
                  {t("record.ghost_target_pace_label")} (Min:Seg / km)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="59"
                    value={targetPaceMin}
                    onChange={(e) => setTargetPaceMin(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-16 text-center text-sm rounded-lg bg-[var(--background)] border border-[var(--border)] text-[var(--text)] py-2 outline-none focus:border-[var(--accent)] font-semibold"
                  />
                  <span className="text-[var(--muted)]">:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={targetPaceSec}
                    onChange={(e) => setTargetPaceSec(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-16 text-center text-sm rounded-lg bg-[var(--background)] border border-[var(--border)] text-[var(--text)] py-2 outline-none focus:border-[var(--accent)] font-semibold"
                  />
                  <span className="text-xs text-[var(--muted)]">/km</span>
                </div>
              </div>
            )}

            {ghostMode === "activity" && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
                  {t("record.ghost_select_activity")}
                </label>
                {pastActivities.length === 0 ? (
                  <p className="text-xs text-amber-500 bg-amber-500/5 border border-amber-500/10 p-2 rounded-lg">
                    {language === "en"
                      ? `No past ${sportLabel(sport, language).toLowerCase()} activities in history yet.`
                      : `Nenhum treino de ${sportLabel(sport, language).toLowerCase()} no histórico.`}
                  </p>
                ) : (
                  <select
                    value={selectedActivityId}
                    onChange={(e) => setSelectedActivityId(e.target.value)}
                    className="w-full text-sm rounded-lg bg-[var(--background)] border border-[var(--border)] text-[var(--text)] px-3 py-2 outline-none focus:border-[var(--accent)] transition-colors font-semibold"
                  >
                    {pastActivities.map((act) => {
                      const dateStr = new Date(act.startedAt).toLocaleDateString(
                        language === "en" ? "en-US" : "pt-BR",
                        { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
                      );
                      const distStr = formatDistance(act.distanceM);
                      const paceStr = formatPace(act.avgPaceSecKm);
                      return (
                        <option key={act.id} value={act.id}>
                          {dateStr} - {distStr} ({paceStr}/km)
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
            )}
          </div>

          {ghostMode !== "disabled" && (
            <div className="border-t border-[var(--border)]/60 pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {audioAlerts ? (
                    <Volume2 size={16} className="text-[var(--accent)] animate-pulse" />
                  ) : (
                    <VolumeX size={16} className="text-[var(--muted)]" />
                  )}
                  <span className="text-xs font-semibold text-[var(--text)]">
                    {t("record.ghost_audio_alerts")}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAudioAlerts(!audioAlerts)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                    audioAlerts ? "bg-[var(--accent)]" : "bg-white/10"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      audioAlerts ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {audioAlerts && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted)]">
                    {t("record.ghost_audio_freq")}
                  </label>
                  <div className="flex gap-2">
                    {(["1km", "2min", "5min"] as const).map((freq) => (
                      <button
                        key={freq}
                        type="button"
                        onClick={() => setAudioFreq(freq)}
                        className={`flex-1 text-xs py-1.5 px-2 rounded-lg border font-medium transition-colors ${
                          audioFreq === freq
                            ? "bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--accent)]"
                            : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--muted)]"
                        }`}
                      >
                        {t(`record.ghost_audio_freq_${freq}`)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!isActive && status !== "saving" && (
        <div className="stat-card space-y-3 border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  voiceCoachConfig.enabled
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : "bg-[var(--surface-hover)] text-[var(--muted)]"
                }`}
              >
                <Headphones size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)]">
                  {t("voice_coach.title")}
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  {voiceCoachConfig.enabled
                    ? voiceCoachConfig.triggerType === "distance"
                      ? `${t("voice_coach.trigger_distance")}: ${
                          voiceCoachConfig.distanceIntervalM < 1000
                            ? `${voiceCoachConfig.distanceIntervalM} m`
                            : `${voiceCoachConfig.distanceIntervalM / 1000} km`
                        }`
                      : `${t("voice_coach.trigger_time")}: ${
                          voiceCoachConfig.timeIntervalSec / 60
                        } min`
                    : t("voice_coach.enable_desc")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsVoiceCoachModalOpen(true)}
              className="btn-ghost text-xs py-1.5 px-3 border border-[var(--border)] hover:border-[var(--accent)] text-[var(--accent)] font-semibold"
            >
              ⚙️ {t("voice_coach.voice_settings")}
            </button>
          </div>
        </div>
      )}

      {!isActive && status !== "saving" && (
        <div className="stat-card space-y-3 border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  autoPauseConfig.enabled
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                    : "bg-[var(--surface-hover)] text-[var(--muted)]"
                }`}
              >
                <PauseCircle size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)]">
                  {t("auto_pause.title")}
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  {autoPauseConfig.enabled
                    ? `${autoPauseConfig.minSpeedKmh} km/h · ${autoPauseConfig.pauseDelaySec}s`
                    : t("auto_pause.enable_desc")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsAutoPauseModalOpen(true)}
              className="btn-ghost text-xs py-1.5 px-3 border border-[var(--border)] hover:border-amber-500 text-amber-400 font-semibold"
            >
              ⚙️ Ajustes Auto-Pause
            </button>
          </div>
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

      <VoiceCoachModal
        config={voiceCoachConfig}
        isOpen={isVoiceCoachModalOpen}
        onClose={() => setIsVoiceCoachModalOpen(false)}
        onSave={updateVoiceCoachConfig}
      />

      <AutoPauseModal
        config={autoPauseConfig}
        isOpen={isAutoPauseModalOpen}
        onClose={() => setIsAutoPauseModalOpen(false)}
        onSave={updateAutoPauseConfig}
      />

      <WorkoutLibraryModal
        isOpen={isWorkoutLibraryModalOpen}
        onClose={() => setIsWorkoutLibraryModalOpen(false)}
        onSelectWorkout={(w) => {
          setSelectedWorkout(w);
          setStructuredWorkout(w);
        }}
        selectedWorkoutId={selectedWorkout?.id}
      />
    </div>
  );
}
