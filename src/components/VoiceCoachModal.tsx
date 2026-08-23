"use client";

import { useState } from "react";
import {
  Volume2,
  VolumeX,
  X,
  Play,
  Check,
  Headphones,
  Gauge,
  Clock,
  Heart,
  Activity,
  Sliders,
  Footprints,
  Zap,
  RefreshCw,
  Mountain,
} from "lucide-react";
import type { VoiceCoachConfig, Sport } from "@/lib/types";
import { DEFAULT_VOICE_COACH_CONFIG, playVoiceCoachPreview } from "@/lib/voice-coach";
import { useI18n } from "@/lib/i18n";

interface VoiceCoachModalProps {
  config: VoiceCoachConfig;
  isOpen: boolean;
  onClose: () => void;
  onSave: (newConfig: VoiceCoachConfig) => void;
  sport?: Sport;
}

export function VoiceCoachModal({
  config: initialConfig,
  isOpen,
  onClose,
  onSave,
  sport = "running",
}: VoiceCoachModalProps) {
  const { t, language } = useI18n();
  const [config, setConfig] = useState<VoiceCoachConfig>({
    ...DEFAULT_VOICE_COACH_CONFIG,
    ...initialConfig,
  });
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  if (!isOpen) return null;

  const handleToggle = (key: keyof VoiceCoachConfig) => {
    setConfig((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handlePreview = () => {
    setIsPlayingPreview(true);
    playVoiceCoachPreview(config, language, sport);
    setTimeout(() => {
      setIsPlayingPreview(false);
    }, 4500);
  };

  const handleSaveAndClose = () => {
    onSave(config);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg max-h-[92vh] bg-[var(--surface)] border-t sm:border border-[var(--border)] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden safe-area-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-[var(--accent)] flex items-center justify-center">
              <Headphones size={22} />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                {t("voice_coach.title")}
              </h3>
              <p className="text-xs text-[var(--muted)]">
                {t("voice_coach.subtitle")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[var(--muted)] hover:text-white rounded-lg transition hover:bg-[var(--surface-hover)]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-6 text-sm">
          {/* Master Enable Card */}
          <div
            onClick={() => handleToggle("enabled")}
            className={`p-4 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              config.enabled
                ? "bg-[var(--accent)]/10 border-[var(--accent)] text-white"
                : "bg-[var(--surface-hover)] border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  config.enabled
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--border)] text-[var(--muted)]"
                }`}
              >
                {config.enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </div>
              <div>
                <p className="font-semibold text-white">
                  {t("voice_coach.enable")}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {t("voice_coach.enable_desc")}
                </p>
              </div>
            </div>
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                config.enabled
                  ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                  : "border-[var(--border)]"
              }`}
            >
              {config.enabled && <Check size={14} />}
            </div>
          </div>

          {config.enabled && (
            <>
              {/* Trigger Mode Selector */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
                  <Clock size={14} /> {t("voice_coach.trigger_type")}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setConfig((prev) => ({ ...prev, triggerType: "distance" }))
                    }
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                      config.triggerType === "distance"
                        ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-md"
                        : "bg-[var(--surface-hover)] border-[var(--border)] text-[var(--muted)] hover:text-white"
                    }`}
                  >
                    <Footprints size={16} />
                    {t("voice_coach.trigger_distance")}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setConfig((prev) => ({ ...prev, triggerType: "time" }))
                    }
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                      config.triggerType === "time"
                        ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-md"
                        : "bg-[var(--surface-hover)] border-[var(--border)] text-[var(--muted)] hover:text-white"
                    }`}
                  >
                    <Clock size={16} />
                    {t("voice_coach.trigger_time")}
                  </button>
                </div>

                {/* Interval selection */}
                {config.triggerType === "distance" ? (
                  <div className="space-y-1.5 mt-2">
                    <label className="text-xs text-[var(--muted)]">
                      {t("voice_coach.interval_distance")}
                    </label>
                    <select
                      value={config.distanceIntervalM}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          distanceIntervalM: Number(e.target.value),
                        }))
                      }
                      className="input-field w-full text-xs font-medium"
                    >
                      <option value={500}>{t("voice_coach.interval_500m")}</option>
                      <option value={1000}>{t("voice_coach.interval_1km")}</option>
                      <option value={2000}>{t("voice_coach.interval_2km")}</option>
                      <option value={5000}>{t("voice_coach.interval_5km")}</option>
                      <option value={10000}>{t("voice_coach.interval_10km")}</option>
                      <option value={15000}>{t("voice_coach.interval_15km")}</option>
                      <option value={20000}>{t("voice_coach.interval_20km")}</option>
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1.5 mt-2">
                    <label className="text-xs text-[var(--muted)]">
                      {t("voice_coach.interval_time")}
                    </label>
                    <select
                      value={config.timeIntervalSec}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          timeIntervalSec: Number(e.target.value),
                        }))
                      }
                      className="input-field w-full text-xs font-medium"
                    >
                      <option value={60}>{t("voice_coach.interval_1min")}</option>
                      <option value={120}>{t("voice_coach.interval_2min")}</option>
                      <option value={180}>{t("voice_coach.interval_3min")}</option>
                      <option value={300}>{t("voice_coach.interval_5min")}</option>
                      <option value={600}>{t("voice_coach.interval_10min")}</option>
                      <option value={900}>{t("voice_coach.interval_15min")}</option>
                      <option value={1200}>{t("voice_coach.interval_20min")}</option>
                      <option value={1800}>{t("voice_coach.interval_30min")}</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Metrics Checkboxes */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
                  <Activity size={14} /> {t("voice_coach.metrics_to_speak")}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Distance */}
                  <div
                    onClick={() => handleToggle("speakDistance")}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                      config.speakDistance
                        ? "bg-[var(--surface-hover)] border-[var(--accent)] text-white"
                        : "bg-[var(--surface-hover)]/40 border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Footprints size={16} className="text-orange-400" />
                      <span className="text-xs font-medium">
                        {t("voice_coach.metric_distance")}
                      </span>
                    </div>
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        config.speakDistance
                          ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                          : "border-[var(--border)]"
                      }`}
                    >
                      {config.speakDistance && <Check size={12} />}
                    </div>
                  </div>

                  {/* Time */}
                  <div
                    onClick={() => handleToggle("speakTime")}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                      config.speakTime
                        ? "bg-[var(--surface-hover)] border-[var(--accent)] text-white"
                        : "bg-[var(--surface-hover)]/40 border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-blue-400" />
                      <span className="text-xs font-medium">
                        {t("voice_coach.metric_time")}
                      </span>
                    </div>
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        config.speakTime
                          ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                          : "border-[var(--border)]"
                      }`}
                    >
                      {config.speakTime && <Check size={12} />}
                    </div>
                  </div>

                  {/* Avg Pace / Speed */}
                  <div
                    onClick={() => handleToggle("speakAvgPace")}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                      config.speakAvgPace
                        ? "bg-[var(--surface-hover)] border-[var(--accent)] text-white"
                        : "bg-[var(--surface-hover)]/40 border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Gauge size={16} className="text-emerald-400" />
                      <span className="text-xs font-medium">
                        {sport === "cycling"
                          ? t("voice_coach.metric_speed_kmh")
                          : t("voice_coach.metric_avg_pace")}
                      </span>
                    </div>
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        config.speakAvgPace
                          ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                          : "border-[var(--border)]"
                      }`}
                    >
                      {config.speakAvgPace && <Check size={12} />}
                    </div>
                  </div>

                  {/* Instant Pace / Speed */}
                  <div
                    onClick={() =>
                      handleToggle(
                        sport === "cycling" ? "speakCurrentSpeedKmh" : "speakCurrentPace"
                      )
                    }
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                      (sport === "cycling" ? config.speakCurrentSpeedKmh : config.speakCurrentPace)
                        ? "bg-[var(--surface-hover)] border-[var(--accent)] text-white"
                        : "bg-[var(--surface-hover)]/40 border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Gauge size={16} className="text-cyan-400" />
                      <span className="text-xs font-medium">
                        {sport === "cycling"
                          ? t("voice_coach.metric_current_speed_kmh")
                          : t("voice_coach.metric_current_pace")}
                      </span>
                    </div>
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        (sport === "cycling" ? config.speakCurrentSpeedKmh : config.speakCurrentPace)
                          ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                          : "border-[var(--border)]"
                      }`}
                    >
                      {(sport === "cycling" ? config.speakCurrentSpeedKmh : config.speakCurrentPace) && (
                        <Check size={12} />
                      )}
                    </div>
                  </div>

                  {/* Cadence (RPM) */}
                  <div
                    onClick={() => handleToggle("speakCadence")}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                      config.speakCadence
                        ? "bg-[var(--surface-hover)] border-[var(--accent)] text-white"
                        : "bg-[var(--surface-hover)]/40 border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <RefreshCw size={16} className="text-cyan-300" />
                      <span className="text-xs font-medium">
                        {t("voice_coach.metric_cadence")}
                      </span>
                    </div>
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        config.speakCadence
                          ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                          : "border-[var(--border)]"
                      }`}
                    >
                      {config.speakCadence && <Check size={12} />}
                    </div>
                  </div>

                  {/* Power (Watts) */}
                  <div
                    onClick={() => handleToggle("speakPowerWatts")}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                      config.speakPowerWatts
                        ? "bg-[var(--surface-hover)] border-[var(--accent)] text-white"
                        : "bg-[var(--surface-hover)]/40 border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Zap size={16} className="text-amber-400" />
                      <span className="text-xs font-medium">
                        {t("voice_coach.metric_power_watts")}
                      </span>
                    </div>
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        config.speakPowerWatts
                          ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                          : "border-[var(--border)]"
                      }`}
                    >
                      {config.speakPowerWatts && <Check size={12} />}
                    </div>
                  </div>

                  {/* Elevation Gain */}
                  <div
                    onClick={() => handleToggle("speakElevationGain")}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                      config.speakElevationGain
                        ? "bg-[var(--surface-hover)] border-[var(--accent)] text-white"
                        : "bg-[var(--surface-hover)]/40 border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Mountain size={16} className="text-emerald-300" />
                      <span className="text-xs font-medium">
                        {t("voice_coach.metric_elevation_gain")}
                      </span>
                    </div>
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        config.speakElevationGain
                          ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                          : "border-[var(--border)]"
                      }`}
                    >
                      {config.speakElevationGain && <Check size={12} />}
                    </div>
                  </div>

                  {/* Last Split */}
                  <div
                    onClick={() => handleToggle("speakLastSplit")}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                      config.speakLastSplit
                        ? "bg-[var(--surface-hover)] border-[var(--accent)] text-white"
                        : "bg-[var(--surface-hover)]/40 border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Activity size={16} className="text-purple-400" />
                      <span className="text-xs font-medium">
                        {t("voice_coach.metric_last_split")}
                      </span>
                    </div>
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        config.speakLastSplit
                          ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                          : "border-[var(--border)]"
                      }`}
                    >
                      {config.speakLastSplit && <Check size={12} />}
                    </div>
                  </div>

                  {/* Heart Rate */}
                  <div
                    onClick={() => handleToggle("speakHeartRate")}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                      config.speakHeartRate
                        ? "bg-[var(--surface-hover)] border-[var(--accent)] text-white"
                        : "bg-[var(--surface-hover)]/40 border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Heart size={16} className="text-rose-400" />
                      <span className="text-xs font-medium">
                        {t("voice_coach.metric_heart_rate")}
                      </span>
                    </div>
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        config.speakHeartRate
                          ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                          : "border-[var(--border)]"
                      }`}
                    >
                      {config.speakHeartRate && <Check size={12} />}
                    </div>
                  </div>

                  {/* Heart Rate Zone */}
                  <div
                    onClick={() => handleToggle("speakHeartRateZone")}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition sm:col-span-2 ${
                      config.speakHeartRateZone
                        ? "bg-[var(--surface-hover)] border-[var(--accent)] text-white"
                        : "bg-[var(--surface-hover)]/40 border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Heart size={16} className="text-amber-400" />
                      <span className="text-xs font-medium">
                        {t("voice_coach.metric_heart_rate_zone")}
                      </span>
                    </div>
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        config.speakHeartRateZone
                          ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                          : "border-[var(--border)]"
                      }`}
                    >
                      {config.speakHeartRateZone && <Check size={12} />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Voice Sound Controls (Sliders) */}
              <div className="space-y-3 pt-2 border-t border-[var(--border)]">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
                  <Sliders size={14} /> {t("voice_coach.voice_settings")}
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Speed / Rate */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-[var(--muted)]">
                      <span>{t("voice_coach.speech_rate")}</span>
                      <span className="font-mono text-white font-bold">
                        {config.speechRate.toFixed(1)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.7"
                      max="1.5"
                      step="0.1"
                      value={config.speechRate}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          speechRate: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full accent-[var(--accent)] cursor-pointer"
                    />
                  </div>

                  {/* Volume */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-[var(--muted)]">
                      <span>{t("voice_coach.speech_volume")}</span>
                      <span className="font-mono text-white font-bold">
                        {Math.round(config.speechVolume * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="1.0"
                      step="0.1"
                      value={config.speechVolume}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          speechVolume: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full accent-[var(--accent)] cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Preview Button */}
              <button
                type="button"
                onClick={handlePreview}
                disabled={isPlayingPreview}
                className="w-full py-2.5 px-4 rounded-xl border border-orange-500/30 bg-orange-500/10 text-[var(--accent)] font-semibold text-xs hover:bg-orange-500/20 transition flex items-center justify-center gap-2"
              >
                <Play size={14} className={isPlayingPreview ? "animate-spin" : ""} />
                {isPlayingPreview
                  ? t("voice_coach.preview_playing")
                  : t("voice_coach.preview_btn")}
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] border-t border-[var(--border)] bg-[var(--surface-hover)]/30 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost py-2 px-4 text-xs font-semibold"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSaveAndClose}
            className="btn-primary py-2 px-5 text-xs font-semibold flex items-center gap-1.5"
          >
            <Check size={14} />
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
