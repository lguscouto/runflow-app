"use client";

import React, { useState } from "react";
import { PauseCircle, Check, X, Volume2, Gauge, ShieldAlert, Sparkles, Activity } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { AutoPauseConfig } from "@/lib/types";
import { DEFAULT_AUTO_PAUSE_CONFIG } from "@/lib/auto-pause";

interface AutoPauseModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AutoPauseConfig;
  onSave: (config: AutoPauseConfig) => void;
}

export function AutoPauseModal({
  isOpen,
  onClose,
  config,
  onSave,
}: AutoPauseModalProps) {
  const { t } = useI18n();
  const [currentConfig, setCurrentConfig] = useState<AutoPauseConfig>(
    config || DEFAULT_AUTO_PAUSE_CONFIG
  );

  if (!isOpen) return null;

  const handleToggle = (key: keyof AutoPauseConfig) => {
    setCurrentConfig((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = () => {
    onSave(currentConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-raised)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <PauseCircle size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text)]">
                {t("auto_pause.title")}
              </h2>
              <p className="text-xs text-[var(--muted)]">
                {t("auto_pause.desc")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-2 text-[var(--muted)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--surface)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {/* Master Toggle */}
          <div
            onClick={() => handleToggle("enabled")}
            className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
              currentConfig.enabled
                ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                : "bg-[var(--surface-raised)] border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  currentConfig.enabled
                    ? "bg-amber-500 text-white"
                    : "bg-[var(--surface)] text-[var(--muted)]"
                }`}
              >
                <Activity size={20} />
              </div>
              <div>
                <span className="font-bold block text-sm text-[var(--text)]">
                  {t("auto_pause.enable_toggle")}
                </span>
                <span className="text-xs text-[var(--muted)] block mt-0.5">
                  {t("auto_pause.enable_desc")}
                </span>
              </div>
            </div>
            <div
              className={`w-6 h-6 rounded-md border flex items-center justify-center ${
                currentConfig.enabled
                  ? "bg-amber-500 border-amber-500 text-white"
                  : "border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              {currentConfig.enabled && <Check size={14} strokeWidth={3} />}
            </div>
          </div>

          {currentConfig.enabled && (
            <>
              {/* Threshold Selection */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
                  <Gauge size={14} />
                  {t("auto_pause.threshold_label")}
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    {
                      speed: 5.0,
                      label: t("auto_pause.threshold_cycling_urban"),
                      sub: "5.0 km/h — Recomendado para bike (semáforos e trânsito)",
                    },
                    {
                      speed: 7.0,
                      label: t("auto_pause.threshold_cycling_road"),
                      sub: "7.0 km/h — Ideal para ciclismo de estrada e ritmo alto",
                    },
                    {
                      speed: 3.5,
                      label: t("auto_pause.threshold_cycling_mtb"),
                      sub: "3.5 km/h — Ideal para subidas íngremes e trilhas MTB",
                    },
                    {
                      speed: 1.5,
                      label: t("auto_pause.threshold_running"),
                      sub: "1.5 km/h (~40:00/km) — Padrão corrida Strava / Garmin",
                    },
                    {
                      speed: 0.8,
                      label: t("auto_pause.threshold_walking"),
                      sub: "0.8 km/h (~75:00/km) — Ideal para caminhada",
                    },
                    {
                      speed: 0.5,
                      label: t("auto_pause.threshold_strict"),
                      sub: "0.5 km/h — Somente em parada absoluta",
                    },
                  ].map((item) => {
                    const isSelected = currentConfig.minSpeedKmh === item.speed;
                    return (
                      <button
                        key={item.speed}
                        type="button"
                        onClick={() =>
                          setCurrentConfig((prev) => ({
                            ...prev,
                            minSpeedKmh: item.speed,
                          }))
                        }
                        className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                          isSelected
                            ? "bg-amber-500/15 border-amber-500 text-[var(--text)] font-semibold shadow-sm"
                            : "bg-[var(--surface-raised)] border-[var(--border)] text-[var(--muted)] hover:border-amber-500/30"
                        }`}
                      >
                        <div>
                          <div className="text-sm font-medium text-[var(--text)]">
                            {item.label}
                          </div>
                          <div className="text-xs text-[var(--muted)] mt-0.5">
                            {item.sub}
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                            isSelected
                              ? "border-amber-500 bg-amber-500 text-white"
                              : "border-[var(--border)]"
                          }`}
                        >
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Confirmation Delay */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] flex items-center justify-between">
                  <span>Tempo de confirmação de parada</span>
                  <span className="text-amber-400 font-mono font-bold">
                    {currentConfig.pauseDelaySec} segundos
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[2, 3, 5].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() =>
                        setCurrentConfig((prev) => ({
                          ...prev,
                          pauseDelaySec: sec,
                        }))
                      }
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        currentConfig.pauseDelaySec === sec
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-[var(--surface-raised)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      {sec}s {sec === 3 ? "(Padrão)" : ""}
                    </button>
                  ))}
                </div>
              </div>

              {/* Audio Alerts */}
              <div
                onClick={() => handleToggle("audioFeedback")}
                className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  currentConfig.audioFeedback
                    ? "bg-amber-500/10 border-amber-500/40 text-[var(--text)]"
                    : "bg-[var(--surface-raised)] border-[var(--border)] text-[var(--muted)]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Volume2
                    size={18}
                    className={
                      currentConfig.audioFeedback
                        ? "text-amber-400"
                        : "text-[var(--muted)]"
                    }
                  />
                  <span className="text-sm font-medium">
                    {t("auto_pause.audio_feedback")}
                  </span>
                </div>
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                    currentConfig.audioFeedback
                      ? "bg-amber-500 border-amber-500 text-white"
                      : "border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  {currentConfig.audioFeedback && (
                    <Check size={12} strokeWidth={3} />
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)] bg-[var(--surface-raised)] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--text)] transition-colors rounded-xl"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn-primary py-2 px-5 text-sm font-bold flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-lg shadow-amber-500/20"
          >
            <Check size={16} />
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
