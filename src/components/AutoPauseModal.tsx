"use client";

import React, { useEffect, useState } from "react";
import { PauseCircle, Check, X, Volume2, Gauge, ShieldAlert, Sparkles, Activity } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { AutoPauseConfig } from "@/lib/types";
import { DEFAULT_AUTO_PAUSE_CONFIG } from "@/lib/auto-pause";
import { useModalA11y } from "@/hooks/useModalA11y";

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
  const { modalRef } = useModalA11y({ isOpen, onClose });
  const [currentConfig, setCurrentConfig] = useState<AutoPauseConfig>(
    config || DEFAULT_AUTO_PAUSE_CONFIG
  );

  useEffect(() => {
    if (isOpen) {
      setCurrentConfig({ ...DEFAULT_AUTO_PAUSE_CONFIG, ...config });
    }
  }, [config, isOpen]);

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
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("auto_pause.title")}
        className="bg-[var(--surface)] border-t sm:border border-[var(--border)] rounded-t-3xl sm:rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh] safe-area-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-raised)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-[var(--color-status-warning)] flex items-center justify-center">
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
            aria-label={t("common.close")}
            className="p-2 text-[var(--muted)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--surface)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {/* Master Toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={currentConfig.enabled}
            aria-label={t("auto_pause.enable_toggle")}
            onClick={() => handleToggle("enabled")}
            className={`w-full text-left p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
              currentConfig.enabled
                ? "bg-amber-500/10 border-amber-500/40 text-[var(--color-status-warning)]"
                : "bg-[var(--surface-raised)] border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  currentConfig.enabled
                    ? "bg-amber-500 text-black"
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
                  ? "bg-amber-500 border-amber-500 text-black"
                  : "border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              {currentConfig.enabled && <Check size={14} strokeWidth={3} />}
            </div>
          </button>

          {currentConfig.enabled && (
            <>
              {/* Threshold Selection */}
              <div className="space-y-3">
                <span id="auto-pause-threshold-label" className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
                  <Gauge size={14} />
                  {t("auto_pause.threshold_label")}
                </span>
                <div role="group" aria-labelledby="auto-pause-threshold-label" className="grid grid-cols-1 gap-2">
                  {[
                    {
                      speed: 5.0,
                      label: t("auto_pause.threshold_cycling_urban"),
                      sub: t("auto_pause.threshold_sub_urban"),
                    },
                    {
                      speed: 7.0,
                      label: t("auto_pause.threshold_cycling_road"),
                      sub: t("auto_pause.threshold_sub_road"),
                    },
                    {
                      speed: 3.5,
                      label: t("auto_pause.threshold_cycling_mtb"),
                      sub: t("auto_pause.threshold_sub_mtb"),
                    },
                    {
                      speed: 1.5,
                      label: t("auto_pause.threshold_running"),
                      sub: t("auto_pause.threshold_sub_running"),
                    },
                    {
                      speed: 0.8,
                      label: t("auto_pause.threshold_walking"),
                      sub: t("auto_pause.threshold_sub_walking"),
                    },
                    {
                      speed: 0.5,
                      label: t("auto_pause.threshold_strict"),
                      sub: t("auto_pause.threshold_sub_strict"),
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
                        aria-pressed={isSelected}
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
                              ? "border-amber-500 bg-amber-500 text-black"
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
                <span id="auto-pause-delay-label" className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] flex items-center justify-between">
                  <span>{t("auto_pause.pause_delay_label")}</span>
                  <span className="text-[var(--color-status-warning)] font-mono font-bold">
                    {currentConfig.pauseDelaySec} {t("auto_pause.seconds")}
                  </span>
                </span>
                <div role="group" aria-labelledby="auto-pause-delay-label" className="grid grid-cols-3 gap-2">
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
                      aria-pressed={currentConfig.pauseDelaySec === sec}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        currentConfig.pauseDelaySec === sec
                          ? "bg-amber-500 text-black border-amber-500"
                          : "bg-[var(--surface-raised)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      {sec}s {sec === 3 ? t("auto_pause.default") : ""}
                    </button>
                  ))}
                </div>
              </div>

              {/* Audio Alerts */}
              <button
                type="button"
                role="checkbox"
                aria-checked={currentConfig.audioFeedback}
                aria-label={t("auto_pause.audio_feedback")}
                onClick={() => handleToggle("audioFeedback")}
                className={`w-full text-left p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
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
                        ? "text-[var(--color-status-warning)]"
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
                      ? "bg-amber-500 border-amber-500 text-black"
                      : "border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  {currentConfig.audioFeedback && (
                    <Check size={12} strokeWidth={3} />
                  )}
                </div>
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] border-t border-[var(--border)] bg-[var(--surface-raised)] flex items-center justify-end gap-3">
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
            className="btn-primary py-2 px-5 text-sm font-bold flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black border-0 shadow-lg shadow-amber-500/20"
          >
            <Check size={16} />
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
