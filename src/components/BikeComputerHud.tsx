"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Square,
  Lock,
  Unlock,
  Flag,
  Sun,
  Moon,
  Zap,
  RotateCw,
  Map as MapIcon,
  LayoutGrid,
  Heart,
  Mountain,
  Gauge,
  Bike as BikeIcon,
  PauseCircle,
  AlertTriangle,
  RefreshCw,
  SkipForward,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import type {
  TrackPoint,
  ManualLap,
  BikeHudTheme,
  BikeHudOrientation,
  BikeHudLayout,
  HeartRateZone,
  Gear,
  ClimbSegment,
  ClimbProgressState,
  FlatWorkoutStep,
} from "@/lib/types";
import type { RecorderStats } from "@/hooks/useWorkoutRecorder";
import { LiveElevationProfile } from "@/components/LiveElevationProfile";
import { ClimbProHudCard } from "@/components/ClimbProHudCard";
import {
  getStepTypeBadgeStyle,
  resolveStepPowerTargetWatts,
  formatStepCadenceRange,
} from "@/lib/structured-workout";
import { DEFAULT_FTP_WATTS } from "@/lib/power-zones";
import {
  formatDistance,
  formatDuration,
  formatSpeed,
  formatWatts,
  formatGrade,
  formatVam,
  formatElevation,
  formatCalories,
} from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { haptics } from "@/lib/haptics";
import { MapSkeleton } from "@/components/LoadingSkeletons";

const LiveMapTrack = dynamic(
  () => import("@/components/LiveMapTrack").then((m) => m.LiveMapTrack),
  {
    ssr: false,
    loading: () => (
      <MapSkeleton label="Carregando mapa / Loading map" height={280} className="h-full" />
    ),
  }
);

interface BikeComputerHudProps {
  stats: RecorderStats;
  points: TrackPoint[];
  status: "idle" | "recording" | "paused" | "saving";
  isAutoPaused: boolean;
  hrBpm: number | null;
  currentZone: HeartRateZone | null;
  selectedBike?: Gear | null;
  liveCalories?: number | null;
  manualLaps: ManualLap[];
  currentLapNumber: number;
  lastCompletedLap: ManualLap | null;
  cadenceRpm?: number | null;
  powerSource?: "sensor" | "estimated";
  climbProgress?: ClimbProgressState | null;
  detectedClimbs?: ClimbSegment[];
  routePoints?: Array<{ lat: number; lng: number; elevation?: number }>;
  currentWorkoutStep?: FlatWorkoutStep | null;
  nextWorkoutStep?: FlatWorkoutStep | null;
  workoutName?: string;
  stepElapsedSec?: number;
  stepDistanceM?: number;
  userFtp?: number;
  onSkipWorkoutStep?: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onDiscard: () => void;
  onManualLap: () => void;
  onClose: () => void;
}

export function BikeComputerHud({
  stats,
  points,
  status,
  isAutoPaused,
  hrBpm,
  currentZone,
  selectedBike,
  liveCalories,
  manualLaps,
  currentLapNumber,
  lastCompletedLap,
  cadenceRpm,
  powerSource = "estimated",
  climbProgress,
  detectedClimbs = [],
  routePoints = [],
  currentWorkoutStep,
  nextWorkoutStep,
  workoutName,
  stepElapsedSec = 0,
  stepDistanceM = 0,
  userFtp = DEFAULT_FTP_WATTS,
  onSkipWorkoutStep,
  onPause,
  onResume,
  onStop,
  onDiscard,
  onManualLap,
  onClose,
}: BikeComputerHudProps) {
  const { t } = useI18n();
  const effectiveCadence = cadenceRpm ?? stats.currentCadenceRpm ?? null;
  const effectiveClimbProg = climbProgress ?? stats.climbProgress ?? null;
  const [profileZoomMode, setProfileZoomMode] = useState<"full" | "climb">("full");

  // Customization States
  const [theme, setTheme] = useState<BikeHudTheme>("dark");
  const [orientationMode, setOrientationMode] = useState<BikeHudOrientation>("auto");
  const [isLandscape, setIsLandscape] = useState(false);
  const [layoutMode, setLayoutMode] = useState<BikeHudLayout>("split_map");

  // Touch Lock (Glove / Rain Mode)
  const [isLocked, setIsLocked] = useState(false);
  const [unlockProgress, setUnlockProgress] = useState(0);
  const unlockTimerRef = useRef<NodeJS.Timeout | null>(null);
  const unlockStartTimeRef = useRef<number | null>(null);

  // Lap notification banner
  const [lapBanner, setLapBanner] = useState<ManualLap | null>(null);
  const lapBannerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Detect Device Orientation
  useEffect(() => {
    function updateOrientation() {
      if (typeof window === "undefined") return;
      const isLand = window.innerWidth > window.innerHeight;
      if (orientationMode === "auto") {
        setIsLandscape(isLand);
      } else if (orientationMode === "landscape") {
        setIsLandscape(true);
      } else {
        setIsLandscape(false);
      }
    }

    updateOrientation();
    window.addEventListener("resize", updateOrientation);
    window.addEventListener("orientationchange", updateOrientation);

    return () => {
      window.removeEventListener("resize", updateOrientation);
      window.removeEventListener("orientationchange", updateOrientation);
    };
  }, [orientationMode]);

  // Show banner when lap completed
  useEffect(() => {
    if (lastCompletedLap) {
      setLapBanner(lastCompletedLap);
      if (lapBannerTimeoutRef.current) clearTimeout(lapBannerTimeoutRef.current);
      lapBannerTimeoutRef.current = setTimeout(() => {
        setLapBanner(null);
      }, 5000);
    }
  }, [lastCompletedLap]);

  // Speed Trend Indicator
  const speedTrend = useMemo(() => {
    if (!stats.currentSpeedKmh || !stats.avgSpeedKmh) return "same";
    const diff = stats.currentSpeedKmh - stats.avgSpeedKmh;
    if (diff > 0.6) return "up";
    if (diff < -0.6) return "down";
    return "same";
  }, [stats.currentSpeedKmh, stats.avgSpeedKmh]);

  // Touch Lock Press Handlers
  const handleTouchLockPressStart = useCallback(() => {
    if (!isLocked) return;
    haptics.light();
    unlockStartTimeRef.current = Date.now();
    const duration = 1500; // 1.5s

    unlockTimerRef.current = setInterval(() => {
      if (!unlockStartTimeRef.current) return;
      const elapsed = Date.now() - unlockStartTimeRef.current;
      const progress = Math.min(100, Math.round((elapsed / duration) * 100));
      setUnlockProgress(progress);

      if (elapsed >= duration) {
        if (unlockTimerRef.current) clearInterval(unlockTimerRef.current);
        unlockTimerRef.current = null;
        unlockStartTimeRef.current = null;
        setUnlockProgress(0);
        setIsLocked(false);
        haptics.heavy();
      }
    }, 30);
  }, [isLocked]);

  const handleTouchLockPressEnd = useCallback(() => {
    if (unlockTimerRef.current) {
      clearInterval(unlockTimerRef.current);
      unlockTimerRef.current = null;
    }
    unlockStartTimeRef.current = null;
    setUnlockProgress(0);
  }, []);

  // Theme Styling Configurations
  const themeStyles = useMemo(() => {
    if (theme === "sun") {
      return {
        bg: "bg-white",
        textPrimary: "text-black",
        textSecondary: "text-neutral-700 font-bold",
        cardBg: "bg-white border-2 border-black shadow-none",
        accent: "text-black",
        speedText: "text-black",
        powerText: "text-black",
        gradeText: "text-black",
        hrText: "text-black",
        topBarBg: "bg-neutral-100 border-b-2 border-black",
        bottomBarBg: "bg-neutral-100 border-t-2 border-black",
        btnPrimary: "bg-black text-white hover:bg-neutral-900 active:bg-neutral-800 border-2 border-black",
        btnSecondary: "bg-white text-black hover:bg-neutral-100 active:bg-neutral-200 border-2 border-black",
        btnDanger: "bg-black text-white hover:bg-red-700 border-2 border-black",
      };
    }

    if (theme === "neo") {
      return {
        bg: "bg-[var(--color-surface-bike-neo)]",
        textPrimary: "text-white",
        textSecondary: "text-cyan-300/70 font-semibold",
        cardBg: "bg-[var(--color-surface-bike-card)]/80 border border-cyan-500/30 backdrop-blur-md shadow-[0_0_20px_var(--color-effect-cyan-soft)]",
        accent: "text-cyan-400",
        speedText: "text-white drop-shadow-[0_0_15px_var(--color-effect-inverse-soft-glow)]",
        powerText: "text-amber-400 drop-shadow-[0_0_15px_var(--color-effect-power-glow)]",
        gradeText: "text-emerald-400 drop-shadow-[0_0_15px_var(--color-effect-grade-glow)]",
        hrText: "text-rose-400 drop-shadow-[0_0_15px_var(--color-effect-hr-glow)]",
        topBarBg: "bg-[var(--color-surface-bike-header)]/90 border-b border-cyan-500/20 backdrop-blur-md",
        bottomBarBg: "bg-[var(--color-surface-bike-header)]/90 border-t border-cyan-500/20 backdrop-blur-md",
        btnPrimary: "bg-cyan-500 text-black hover:bg-cyan-400 active:bg-cyan-600 font-black shadow-[0_0_25px_var(--color-effect-cyan-glow)]",
        btnSecondary: "bg-[var(--color-surface-control)] text-cyan-300 hover:bg-[var(--color-surface-control-hover)] border border-cyan-500/40",
        btnDanger: "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40",
      };
    }

    // Default: "dark" AMOLED
    return {
      bg: "bg-[var(--color-surface-blackout)]",
      textPrimary: "text-white",
      textSecondary: "text-neutral-400 font-semibold",
      cardBg: "bg-[var(--color-surface-bike-dark)] border border-neutral-800 shadow-lg",
      accent: "text-[var(--accent)]",
      speedText: "text-[var(--color-palette-neutral-100)]",
      powerText: "text-amber-400",
      gradeText: "text-emerald-400",
      hrText: "text-rose-400",
      topBarBg: "bg-[var(--color-surface-hud)] border-b border-neutral-800",
      bottomBarBg: "bg-[var(--color-surface-hud)] border-t border-neutral-800",
      btnPrimary: "bg-[var(--accent)] text-black hover:opacity-90 active:scale-[0.98] font-bold shadow-lg shadow-[var(--accent)]/20",
      btnSecondary: "bg-[var(--color-surface-bike-secondary)] text-neutral-200 hover:bg-[var(--color-surface-bike-secondary-hover)] border border-neutral-700",
      btnDanger: "bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/40",
    };
  }, [theme]);

  const isPaused = status === "paused";
  const isRecording = status === "recording";

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col select-none overflow-hidden ${themeStyles.bg}`}
      style={{ touchAction: "manipulation" }}
    >
      {/* 1. TOP STATUS & CONTROL BAR */}
      <div
        className={`shrink-0 flex items-center justify-between px-4 pt-10 pb-3 ${themeStyles.topBarBg} transition-colors`}
      >
        {/* Left: Bike Info & Lap Badge */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/20 border border-white/10 text-xs font-bold">
            <BikeIcon size={14} className={themeStyles.accent} />
            <span className="max-w-[140px] truncate text-white">
              {selectedBike ? selectedBike.name : t("bike_hud.title")}
            </span>
          </div>

          <div className="px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black tabular-nums">
            {t("bike_hud.lap_current", { num: currentLapNumber })}
          </div>
        </div>

        {/* Center: Auto-Pause or State Banner */}
        {isAutoPaused && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 text-black text-xs font-black animate-pulse">
            <PauseCircle size={14} />
            <span>PAUSADO AUTO</span>
          </div>
        )}

        {isPaused && !isAutoPaused && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold animate-pulse">
            <Pause size={13} />
            <span>PAUSADO</span>
          </div>
        )}

        {/* Right: Toggles (Theme, Orientation, Lock, Minimize) */}
        <div className="flex items-center gap-1.5">
          {/* Orientation Selector */}
          <button
            type="button"
            onClick={() => {
              haptics.light();
              if (orientationMode === "auto") setOrientationMode("landscape");
              else if (orientationMode === "landscape") setOrientationMode("portrait");
              else setOrientationMode("auto");
            }}
            className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1 ${themeStyles.btnSecondary}`}
            title="Alternar Orientação"
          >
            <RotateCw size={14} />
            <span className="hidden sm:inline">
              {orientationMode === "auto"
                ? "Auto"
                : orientationMode === "landscape"
                ? "Paisagem"
                : "Retrato"}
            </span>
          </button>

          {/* Theme Selector */}
          <button
            type="button"
            onClick={() => {
              haptics.light();
              if (theme === "dark") setTheme("sun");
              else if (theme === "sun") setTheme("neo");
              else setTheme("dark");
            }}
            className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1 ${themeStyles.btnSecondary}`}
            title="Tema do Ciclocomputador"
          >
            {theme === "sun" ? (
              <Sun size={15} className="text-amber-500" />
            ) : theme === "neo" ? (
              <Zap size={15} className="text-cyan-400" />
            ) : (
              <Moon size={15} className="text-indigo-400" />
            )}
          </button>

          {/* Toggle Map / Data in Landscape */}
          {isLandscape && (
            <button
              type="button"
              onClick={() => {
                haptics.light();
                setLayoutMode((prev) => (prev === "split_map" ? "data_only" : "split_map"));
              }}
              className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1 ${themeStyles.btnSecondary}`}
              title="Alternar Mapa"
            >
              {layoutMode === "split_map" ? <LayoutGrid size={15} /> : <MapIcon size={15} />}
            </button>
          )}

          {/* Lock Screen (Glove/Rain Mode) */}
          <button
            type="button"
            onClick={() => {
              haptics.heavy();
              setIsLocked(true);
            }}
            className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1 ${themeStyles.btnSecondary}`}
            title={t("bike_hud.lock_btn")}
          >
            <Lock size={15} />
          </button>

          {/* Close HUD */}
          <button
            type="button"
            onClick={() => {
              haptics.light();
              onClose();
            }}
            className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1 ${themeStyles.btnSecondary}`}
            title="Sair do HUD"
          >
            <Minimize2 size={15} />
          </button>
        </div>
      </div>

      {/* 2. LAP BANNER NOTIFICATION */}
      {lapBanner && (
        <div className="mx-4 mt-2 py-2 px-4 rounded-xl bg-amber-500 text-black font-black text-xs flex items-center justify-between shadow-xl animate-bounce">
          <div className="flex items-center gap-2">
            <Flag size={16} />
            <span>
              {t("bike_hud.lap_banner", {
                num: lapBanner.lapNumber,
                dist: formatDistance(lapBanner.distanceM),
                speed: formatSpeed(lapBanner.avgSpeedKmh),
              })}
            </span>
          </div>
          <span className="font-mono text-[11px]">{formatDuration(lapBanner.durationSec)}</span>
        </div>
      )}

      {/* 2.5 STRUCTURED WORKOUT ACTIVE STEP BANNER */}
      {currentWorkoutStep && (
        <div className="mx-4 mt-2 p-3 rounded-2xl bg-[var(--color-surface-chart)]/95 border border-orange-500/40 shadow-2xl backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${getStepTypeBadgeStyle(currentWorkoutStep.step.type).bg} ${getStepTypeBadgeStyle(currentWorkoutStep.step.type).text} ${getStepTypeBadgeStyle(currentWorkoutStep.step.type).border}`}
              >
                {currentWorkoutStep.repeatIndex && currentWorkoutStep.totalRepeats
                  ? `${currentWorkoutStep.step.type === "work" ? "Tiro" : "Recup."} ${currentWorkoutStep.repeatIndex}/${currentWorkoutStep.totalRepeats}`
                  : currentWorkoutStep.step.name || getStepTypeBadgeStyle(currentWorkoutStep.step.type).namePt}
              </span>
              <span className="text-xs font-bold text-white font-mono">
                {currentWorkoutStep.step.targetType === "time"
                  ? formatDuration(Math.max(0, currentWorkoutStep.step.targetValue - stepElapsedSec))
                  : currentWorkoutStep.step.targetType === "distance"
                  ? formatDistance(Math.max(0, currentWorkoutStep.step.targetValue - stepDistanceM))
                  : "Livre"}
              </span>
            </div>

            {/* Target Power or Cadence Chip */}
            {(() => {
              const resPower = resolveStepPowerTargetWatts(currentWorkoutStep.step, userFtp);
              if (resPower) {
                const isPowerOnTarget =
                  stats.currentWatts >= resPower.minWatts * 0.9 &&
                  (resPower.maxWatts >= 9000 || stats.currentWatts <= resPower.maxWatts * 1.1);
                return (
                  <div className="flex items-center gap-1 text-[11px] font-mono">
                    <span className="text-[var(--muted)]">Alvo:</span>
                    <span className="font-bold text-amber-300">{resPower.label}</span>
                    {stats.currentWatts > 0 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                        isPowerOnTarget
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : stats.currentWatts < resPower.minWatts
                          ? "bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse"
                          : "bg-rose-500/20 text-rose-400 border-rose-500/30 animate-pulse"
                      }`}>
                        {isPowerOnTarget ? "✓" : stats.currentWatts < resPower.minWatts ? "▲" : "▼"}
                      </span>
                    )}
                  </div>
                );
              }
              if (currentWorkoutStep.step.cadenceTarget) {
                return (
                  <div className="flex items-center gap-1 text-[11px] font-mono">
                    <span className="text-[var(--muted)]">RPM:</span>
                    <span className="font-bold text-cyan-300">
                      {formatStepCadenceRange(currentWorkoutStep.step.cadenceTarget)}
                    </span>
                  </div>
                );
              }
              return null;
            })()}

            {/* Skip Button */}
            {onSkipWorkoutStep && (
              <button
                type="button"
                onClick={() => {
                  haptics.light();
                  onSkipWorkoutStep();
                }}
                className="btn-ghost text-[11px] px-2.5 py-1 border-white/20 hover:border-white/40 flex items-center gap-1 bg-white/5 active:scale-95 transition-all shrink-0"
              >
                <SkipForward size={13} />
                <span>Pular</span>
              </button>
            )}
          </div>

          {/* Mini progress bar */}
          <div className="w-full h-1.5 rounded-full bg-black/40 overflow-hidden border border-white/5">
            <div
              className={`h-full transition-all duration-300 ${getStepTypeBadgeStyle(currentWorkoutStep.step.type).dotColor}`}
              style={{
                width: `${
                  currentWorkoutStep.step.targetType === "distance"
                    ? Math.min(100, (stepDistanceM / (currentWorkoutStep.step.targetValue || 1)) * 100)
                    : currentWorkoutStep.step.targetType === "time"
                    ? Math.min(100, (stepElapsedSec / (currentWorkoutStep.step.targetValue || 1)) * 100)
                    : 100
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* 3. MAIN COCKPIT VIEWPORT */}
      <div className="flex-1 p-3 sm:p-4 overflow-hidden flex flex-col min-h-0">
        {/* =========================================================================
            LANDSCAPE LAYOUT (MODO PAISAGEM / GUIDÃO HORIZONTAL)
           ========================================================================= */}
        {isLandscape ? (
          <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">
            {/* Left: Main Metrics Data Fields Grid */}
            <div
              className={`flex-1 grid ${
                layoutMode === "split_map" ? "grid-cols-3" : "grid-cols-4"
              } grid-rows-2 gap-2.5 min-h-0`}
            >
              {/* Cell 1: CURRENT SPEED (Prominent Giant Cell) */}
              <div
                className={`${themeStyles.cardBg} rounded-2xl p-3 flex flex-col justify-between items-center text-center col-span-2 row-span-1`}
              >
                <div className="w-full flex items-center justify-between">
                  <span className={`text-[11px] uppercase tracking-widest ${themeStyles.textSecondary}`}>
                    {t("bike_hud.speed_current")} (km/h)
                  </span>
                  <div className="flex items-center gap-1 text-xs font-bold">
                    {speedTrend === "up" && <span className="text-emerald-500 font-black">▲</span>}
                    {speedTrend === "down" && <span className="text-rose-500 font-black">▼</span>}
                    <span className="text-xs text-[var(--muted)]">
                      Méd: {formatSpeed(stats.avgSpeedKmh).replace(" km/h", "")}
                    </span>
                  </div>
                </div>

                <div className="flex-1 flex items-center justify-center">
                  <p
                    className={`font-black tabular-nums leading-none tracking-tight ${themeStyles.speedText}`}
                    style={{ fontSize: "clamp(3.5rem, 8.5vw, 6.5rem)" }}
                  >
                    {stats.currentSpeedKmh.toFixed(1)}
                  </p>
                </div>
              </div>

              {/* Cell 2: POWER (WATTS) */}
              <div
                className={`${themeStyles.cardBg} rounded-2xl p-3 flex flex-col justify-between items-center text-center relative`}
              >
                <div className="w-full flex items-center justify-between px-1">
                  <span className={`text-[10px] uppercase tracking-wider ${themeStyles.textSecondary} flex items-center gap-1`}>
                    <Zap size={12} className="fill-amber-400 text-amber-400" />
                    <span>{t("bike_hud.power_watts")}</span>
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider ${
                    powerSource === "sensor"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-white/5 text-[var(--muted)] border border-white/10"
                  }`}>
                    {powerSource === "sensor" ? `⚡ ${t("record.power_source_sensor")}` : `📐 ${t("record.power_source_estimated")}`}
                  </span>
                </div>
                <p
                  className={`font-black tabular-nums leading-none ${themeStyles.powerText}`}
                  style={{ fontSize: "clamp(2rem, 4.5vw, 3.2rem)" }}
                >
                  {formatWatts(stats.currentWatts).replace(" W", "")}
                  <span className="text-xs font-normal ml-1">W</span>
                </p>
                <span className="text-[10px] text-[var(--muted)] font-mono">
                  Méd: {formatWatts(stats.avgWatts)}
                </span>
              </div>

              {/* Cell 3: DISTANCE */}
              <div
                className={`${themeStyles.cardBg} rounded-2xl p-3 flex flex-col justify-between items-center text-center`}
              >
                <span className={`text-[10px] uppercase tracking-wider ${themeStyles.textSecondary}`}>
                  {t("bike_hud.distance")}
                </span>
                <p
                  className={`font-black tabular-nums leading-none ${themeStyles.accent}`}
                  style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)" }}
                >
                  {formatDistance(stats.distanceM)}
                </p>
                <span className="text-[10px] text-[var(--muted)]">
                  {stats.maxSpeedKmh > 0 ? `Máx: ${stats.maxSpeedKmh.toFixed(1)} km/h` : "GPS Ativo"}
                </span>
              </div>

              {/* Cell 4: TIME */}
              <div
                className={`${themeStyles.cardBg} rounded-2xl p-3 flex flex-col justify-between items-center text-center`}
              >
                <span className={`text-[10px] uppercase tracking-wider ${themeStyles.textSecondary}`}>
                  {t("bike_hud.time")}
                </span>
                <p
                  className={`font-black tabular-nums leading-none ${themeStyles.textPrimary}`}
                  style={{ fontSize: "clamp(1.6rem, 3.8vw, 2.8rem)" }}
                >
                  {formatDuration(stats.movingSec || stats.elapsedSec)}
                </p>
                <span className="text-[10px] text-[var(--muted)] font-mono">
                  Total: {formatDuration(stats.elapsedSec)}
                </span>
              </div>

              {/* Cell 5: GRADE & VAM */}
              <div
                className={`${themeStyles.cardBg} rounded-2xl p-3 flex flex-col justify-between items-center text-center`}
              >
                <span className={`text-[10px] uppercase tracking-wider ${themeStyles.textSecondary} flex items-center gap-1`}>
                  <Mountain size={12} />
                  <span>{t("bike_hud.grade")} / VAM</span>
                </span>
                <p
                  className={`font-black tabular-nums leading-none ${themeStyles.gradeText}`}
                  style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}
                >
                  {formatGrade(stats.currentGradePercent)}
                </p>
                <span className="text-[10px] text-[var(--muted)] font-mono">
                  {stats.currentVamMh > 0 ? formatVam(stats.currentVamMh) : "Plano"}
                </span>
              </div>

              {/* Extra Cells when data_only: Cadence, Heart Rate, Calories */}
              {layoutMode === "data_only" && (
                <>
                  {/* Cadence Card */}
                  <div
                    className={`${themeStyles.cardBg} rounded-2xl p-3 flex flex-col justify-between items-center text-center`}
                  >
                    <span className={`text-[10px] uppercase tracking-wider ${themeStyles.textSecondary} flex items-center gap-1`}>
                      <RefreshCw size={12} className="text-cyan-400" />
                      <span>{t("bike_hud.cadence_label")}</span>
                    </span>
                    <p
                      className="font-black tabular-nums leading-none text-cyan-400"
                      style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}
                    >
                      {effectiveCadence !== null ? `${effectiveCadence}` : "—"}
                      <span className="text-xs font-normal ml-1">RPM</span>
                    </p>
                    <span className="text-[10px] text-[var(--muted)] font-mono">
                      {stats.avgCadenceRpm > 0 ? `Méd: ${stats.avgCadenceRpm} RPM` : (effectiveCadence !== null ? "Sensor Conectado" : "Sem sensor")}
                    </span>
                  </div>

                  {/* Heart Rate Card */}
                  <div
                    className={`${themeStyles.cardBg} rounded-2xl p-3 flex flex-col justify-between items-center text-center`}
                  >
                    <span className={`text-[10px] uppercase tracking-wider ${themeStyles.textSecondary} flex items-center gap-1`}>
                      <Heart size={12} className="text-rose-500 fill-rose-500" />
                      <span>FC</span>
                    </span>
                    <p
                      className={`font-black tabular-nums leading-none ${themeStyles.hrText}`}
                      style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}
                    >
                      {hrBpm !== null ? `${hrBpm}` : "—"}
                      <span className="text-xs font-normal ml-1">BPM</span>
                    </p>
                    {currentZone ? (
                      <span
                        style={{
                          backgroundColor: currentZone.bgRgba,
                          color: currentZone.color,
                        }}
                        className="px-2 py-0.5 rounded-full text-[10px] font-black"
                      >
                        Z{currentZone.zone} • {t(currentZone.nameKey)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-[var(--muted)]">Sem sensor</span>
                    )}
                  </div>

                  {/* Calories Card */}
                  <div
                    className={`${themeStyles.cardBg} rounded-2xl p-3 flex flex-col justify-between items-center text-center`}
                  >
                    <span className={`text-[10px] uppercase tracking-wider ${themeStyles.textSecondary}`}>
                      Calorias
                    </span>
                    <p
                      className="font-black tabular-nums leading-none text-orange-400"
                      style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}
                    >
                      {liveCalories != null ? formatCalories(liveCalories) : "—"}
                    </p>
                    <span className="text-[10px] text-[var(--muted)]">kcal estimadas</span>
                  </div>
                </>
              )}
            </div>

            {/* Right: Live Map / ClimbPro in Landscape (if split_map layout active) */}
            {layoutMode === "split_map" && (
              <div className="w-[38%] h-full rounded-2xl overflow-hidden border border-neutral-800 relative shadow-xl flex flex-col gap-2">
                {effectiveClimbProg && (effectiveClimbProg.isActiveClimb || effectiveClimbProg.isApproachingClimb) ? (
                  <div className="flex-1 flex flex-col gap-2 overflow-y-auto p-1">
                    <ClimbProHudCard
                      climbProgress={effectiveClimbProg}
                      currentSpeedKmh={stats.currentSpeedKmh}
                      currentVamMh={stats.currentVamMh}
                    />
                    {(routePoints.length > 0 || points.length > 0) && (
                      <LiveElevationProfile
                        points={routePoints.length > 0 ? routePoints : points}
                        climbs={detectedClimbs}
                        currentDistM={stats.distanceM}
                        activeClimb={effectiveClimbProg.currentClimb}
                        height={95}
                        zoomMode={profileZoomMode}
                        onToggleZoom={() => setProfileZoomMode((p) => (p === "full" ? "climb" : "full"))}
                      />
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full relative">
                    <LiveMapTrack points={points} follow={isRecording} />
                    <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/70 backdrop-blur text-[10px] font-bold text-white z-[1000]">
                      GPS AO VIVO
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* =========================================================================
             PORTRAIT LAYOUT (MODO RETRATO / VERTICAL PADRÃO)
             ========================================================================= */
          <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto">
            {/* ClimbPro Alert / Active Card in Portrait */}
            {effectiveClimbProg && (effectiveClimbProg.isActiveClimb || effectiveClimbProg.isApproachingClimb) && (
              <div className="shrink-0">
                <ClimbProHudCard
                  climbProgress={effectiveClimbProg}
                  currentSpeedKmh={stats.currentSpeedKmh}
                  currentVamMh={stats.currentVamMh}
                />
              </div>
            )}

            {/* Top Main Speed Cell */}
            <div
              className={`${themeStyles.cardBg} rounded-3xl p-5 flex flex-col justify-between items-center text-center flex-1 max-h-[42vh] shrink-0`}
            >
              <div className="w-full flex items-center justify-between px-2">
                <span className={`text-xs uppercase tracking-widest ${themeStyles.textSecondary}`}>
                  {t("bike_hud.speed_current")} (km/h)
                </span>
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  {speedTrend === "up" && <span className="text-emerald-500 font-black text-base">▲</span>}
                  {speedTrend === "down" && <span className="text-rose-500 font-black text-base">▼</span>}
                  <span className="text-xs text-[var(--muted)] font-mono">
                    Méd: {formatSpeed(stats.avgSpeedKmh).replace(" km/h", "")}
                  </span>
                </div>
              </div>

              <div className="flex-1 flex items-center justify-center my-2">
                <p
                  className={`font-black tabular-nums leading-none tracking-tight ${themeStyles.speedText}`}
                  style={{ fontSize: "clamp(5rem, 24vw, 8rem)" }}
                >
                  {stats.currentSpeedKmh.toFixed(1)}
                </p>
              </div>

              <div className="w-full flex items-center justify-between px-3 pt-2 border-t border-white/5 text-xs text-[var(--muted)]">
                <span>Máx: {formatSpeed(stats.maxSpeedKmh)}</span>
                <span>{points.length} pts GPS</span>
              </div>
            </div>

            {/* Middle Grid: Distance & Time */}
            <div className="grid grid-cols-2 gap-3 shrink-0">
              <div className={`${themeStyles.cardBg} rounded-2xl p-4 text-center`}>
                <span className={`text-[10px] uppercase tracking-wider ${themeStyles.textSecondary}`}>
                  {t("bike_hud.distance")}
                </span>
                <p
                  className={`font-black tabular-nums mt-1 ${themeStyles.accent}`}
                  style={{ fontSize: "clamp(2rem, 9vw, 3.2rem)" }}
                >
                  {formatDistance(stats.distanceM)}
                </p>
              </div>

              <div className={`${themeStyles.cardBg} rounded-2xl p-4 text-center`}>
                <span className={`text-[10px] uppercase tracking-wider ${themeStyles.textSecondary}`}>
                  {t("bike_hud.time")}
                </span>
                <p
                  className={`font-black tabular-nums mt-1 ${themeStyles.textPrimary}`}
                  style={{ fontSize: "clamp(2rem, 9vw, 3.2rem)" }}
                >
                  {formatDuration(stats.movingSec || stats.elapsedSec)}
                </p>
              </div>
            </div>

            {/* Bottom Grid: Power & Grade/VAM */}
            <div className="grid grid-cols-2 gap-3 shrink-0">
              <div className={`${themeStyles.cardBg} rounded-2xl p-3.5 text-center flex flex-col justify-between relative`}>
                <div className="w-full flex items-center justify-between">
                  <span className={`text-[10px] uppercase tracking-wider ${themeStyles.textSecondary} flex items-center gap-1`}>
                    <Zap size={12} className="fill-amber-400 text-amber-400" />
                    <span>{t("bike_hud.power_watts")}</span>
                  </span>
                  <span className={`text-[8px] px-1 py-0.5 rounded font-black tracking-wider ${
                    powerSource === "sensor"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-white/5 text-[var(--muted)] border border-white/10"
                  }`}>
                    {powerSource === "sensor" ? `⚡ ${t("record.power_source_sensor")}` : `📐 ${t("record.power_source_estimated")}`}
                  </span>
                </div>
                <p
                  className={`font-black tabular-nums my-1 ${themeStyles.powerText}`}
                  style={{ fontSize: "clamp(1.6rem, 7vw, 2.5rem)" }}
                >
                  {formatWatts(stats.currentWatts)}
                </p>
                <span className="text-[10px] text-[var(--muted)] font-mono">
                  Méd: {formatWatts(stats.avgWatts)}
                </span>
              </div>

              <div className={`${themeStyles.cardBg} rounded-2xl p-3.5 text-center flex flex-col justify-between`}>
                <span className={`text-[10px] uppercase tracking-wider ${themeStyles.textSecondary} flex items-center justify-center gap-1`}>
                  <Mountain size={12} />
                  <span>{t("bike_hud.grade")} / VAM</span>
                </span>
                <p
                  className={`font-black tabular-nums my-1 ${themeStyles.gradeText}`}
                  style={{ fontSize: "clamp(1.6rem, 7vw, 2.5rem)" }}
                >
                  {formatGrade(stats.currentGradePercent)}
                </p>
                <span className="text-[10px] text-[var(--muted)] font-mono">
                  {stats.currentVamMh > 0 ? formatVam(stats.currentVamMh) : "Plano"}
                </span>
              </div>
            </div>

            {/* Sensor Telemetry Row (Cadence & Heart Rate) */}
            {(effectiveCadence !== null || hrBpm !== null) && (
              <div className="grid grid-cols-2 gap-3 shrink-0">
                {/* Cadence Pill */}
                {effectiveCadence !== null ? (
                  <div className={`${themeStyles.cardBg} rounded-xl px-3.5 py-2.5 flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <RefreshCw size={16} className="text-cyan-400 animate-spin" style={{ animationDuration: "3s" }} />
                      <div>
                        <p className="text-xs font-black text-cyan-400 leading-tight">{effectiveCadence} RPM</p>
                        <p className="text-[9px] text-[var(--muted)]">{t("bike_hud.cadence_label")}</p>
                      </div>
                    </div>
                    {stats.avgCadenceRpm > 0 && (
                      <span className="text-[10px] text-[var(--muted)] font-mono">
                        Méd: {stats.avgCadenceRpm}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className={`${themeStyles.cardBg} rounded-xl px-3.5 py-2.5 flex items-center justify-center text-xs text-[var(--muted)]`}>
                    <span className="text-[11px]">Sem Cadência</span>
                  </div>
                )}

                {/* Heart Rate Pill */}
                {hrBpm !== null ? (
                  <div className={`${themeStyles.cardBg} rounded-xl px-3.5 py-2.5 flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <Heart size={16} className="text-rose-500 fill-rose-500 animate-pulse" />
                      <div>
                        <p className="text-xs font-black text-white leading-tight">{hrBpm} BPM</p>
                        <p className="text-[9px] text-[var(--muted)]">FC</p>
                      </div>
                    </div>
                    {currentZone && (
                      <span
                        style={{
                          backgroundColor: currentZone.bgRgba,
                          color: currentZone.color,
                        }}
                        className="px-2 py-0.5 rounded-full text-[10px] font-black"
                      >
                        Z{currentZone.zone}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className={`${themeStyles.cardBg} rounded-xl px-3.5 py-2.5 flex items-center justify-center text-xs text-[var(--muted)]`}>
                    <span className="text-[11px]">Sem Cinta FC</span>
                  </div>
                )}
              </div>
            )}

            {/* Live Elevation Profile (if route or points available) */}
            {(routePoints.length > 2 || detectedClimbs.length > 0 || points.length > 5) && (
              <div className="shrink-0">
                <LiveElevationProfile
                  points={routePoints.length > 0 ? routePoints : points}
                  climbs={detectedClimbs}
                  currentDistM={stats.distanceM}
                  activeClimb={effectiveClimbProg?.currentClimb}
                  height={110}
                  zoomMode={profileZoomMode}
                  onToggleZoom={() => setProfileZoomMode((p) => (p === "full" ? "climb" : "full"))}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. GLOVE-FRIENDLY TACTILE BOTTOM CONTROL BAR */}
      <div
        className={`shrink-0 px-4 pt-3 pb-8 ${themeStyles.bottomBarBg} flex items-center justify-between gap-3 transition-colors`}
      >
        {/* Lap Button (Volta Manual) */}
        <button
          type="button"
          onClick={() => {
            haptics.heavy();
            onManualLap();
          }}
          disabled={status !== "recording" && status !== "paused"}
          className={`flex-1 h-16 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-xs font-black uppercase tracking-wider transition-transform active:scale-95 ${themeStyles.btnSecondary}`}
        >
          <Flag size={20} className="text-amber-400" />
          <span>{t("bike_hud.lap_btn")}</span>
        </button>

        {/* Pause / Resume Button (Main Giant Button) */}
        {isRecording && (
          <button
            type="button"
            onClick={() => {
              haptics.heavy();
              onPause();
            }}
            className={`flex-[1.5] h-16 rounded-2xl flex items-center justify-center gap-2 text-base font-black uppercase tracking-wider transition-transform active:scale-95 bg-amber-500 text-black hover:bg-amber-400 shadow-xl shadow-amber-500/20`}
          >
            <Pause size={24} className="fill-black" />
            <span>{t("record.pause_btn")}</span>
          </button>
        )}

        {isPaused && (
          <button
            type="button"
            onClick={() => {
              haptics.heavy();
              onResume();
            }}
            className={`flex-[1.5] h-16 rounded-2xl flex items-center justify-center gap-2 text-base font-black uppercase tracking-wider transition-transform active:scale-95 ${themeStyles.btnPrimary}`}
          >
            <Play size={24} className="fill-current" />
            <span>{t("record.resume_btn")}</span>
          </button>
        )}

        {/* Finish Workout Button */}
        <button
          type="button"
          onClick={() => {
            haptics.heavy();
            onStop();
          }}
          className={`flex-1 h-16 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-xs font-black uppercase tracking-wider transition-transform active:scale-95 ${themeStyles.btnDanger}`}
        >
          <Square size={20} className="fill-current" />
          <span>{t("record.stop_btn")}</span>
        </button>
      </div>

      {/* 5. TOUCH LOCK OVERLAY (RAIN & GLOVE PROTECTION) */}
      {isLocked && (
        <div
          className="fixed inset-0 z-[999999] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center select-none"
          onTouchStart={handleTouchLockPressStart}
          onTouchEnd={handleTouchLockPressEnd}
          onMouseDown={handleTouchLockPressStart}
          onMouseUp={handleTouchLockPressEnd}
        >
          <div className="w-24 h-24 rounded-full bg-neutral-900 border-2 border-neutral-700 flex items-center justify-center mb-6 relative overflow-hidden">
            {/* Progress Circular Fill */}
            <div
              className="absolute bottom-0 left-0 right-0 bg-amber-500 transition-all"
              style={{ height: `${unlockProgress}%`, opacity: 0.3 }}
            />
            <Lock size={40} className="text-amber-400 z-10 animate-pulse" />
          </div>

          <h2 className="text-xl font-black text-white mb-2">{t("bike_hud.locked_badge")}</h2>
          <p className="text-sm text-neutral-400 max-w-xs mb-8">
            {t("bike_hud.unlock_prompt")}
          </p>

          {/* Touch Unlock Progress Bar */}
          <div className="w-64 h-3 bg-neutral-800 rounded-full overflow-hidden border border-neutral-700">
            <div
              className="h-full bg-amber-500 transition-all duration-75"
              style={{ width: `${unlockProgress}%` }}
            />
          </div>

          <p className="text-[11px] text-neutral-500 mt-4 uppercase tracking-widest font-mono">
            Proteção contra suor e chuva
          </p>
        </div>
      )}
    </div>
  );
}
