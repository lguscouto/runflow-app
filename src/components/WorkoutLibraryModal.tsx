"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Plus,
  Zap,
  Sparkles,
  Flame,
  Check,
  Edit2,
  Trash2,
  Copy,
  Clock,
  Navigation,
  Repeat,
  Activity,
  Bike,
} from "lucide-react";
import type { Sport, StructuredWorkout } from "@/lib/types";
import { BUILTIN_WORKOUT_PRESETS } from "@/lib/workout-presets";
import { getAllStoredWorkouts, deleteStoredWorkout, putWorkout } from "@/lib/storage";
import {
  calculateWorkoutSummary,
  getStepTypeBadgeStyle,
  formatStepTargetDescription,
} from "@/lib/structured-workout";
import { formatDistance, formatDuration } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { haptics } from "@/lib/haptics";
import { WorkoutBuilderModal } from "./WorkoutBuilderModal";
import { useModalA11y } from "@/hooks/useModalA11y";

interface WorkoutLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWorkout: (workout: StructuredWorkout | null) => void;
  selectedWorkoutId?: string | null;
  initialSport?: Sport;
}

export function WorkoutLibraryModal({
  isOpen,
  onClose,
  onSelectWorkout,
  selectedWorkoutId,
  initialSport,
}: WorkoutLibraryModalProps) {
  const { t, language } = useI18n();
  const { modalRef } = useModalA11y({ isOpen, onClose });

  const [filterTab, setFilterTab] = useState<"all" | "presets" | "custom">("all");
  const [sportFilter, setSportFilter] = useState<"all" | "running" | "cycling">(
    initialSport === "cycling" ? "cycling" : initialSport === "running" ? "running" : "all"
  );
  const [customWorkouts, setCustomWorkouts] = useState<StructuredWorkout[]>([]);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<StructuredWorkout | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCustomWorkouts();
      if (initialSport) {
        setSportFilter(initialSport === "cycling" ? "cycling" : "running");
      }
    }
  }, [isOpen, initialSport]);

  async function loadCustomWorkouts() {
    try {
      const stored = await getAllStoredWorkouts();
      setCustomWorkouts(stored);
    } catch (e) {
      console.error("Erro ao carregar treinos customizados:", e);
    }
  }

  if (!isOpen) return null;

  const allWorkouts = [...BUILTIN_WORKOUT_PRESETS, ...customWorkouts];

  const displayedWorkouts = allWorkouts.filter((w) => {
    if (filterTab === "presets" && !w.isPreset) return false;
    if (filterTab === "custom" && w.isPreset) return false;
    if (sportFilter !== "all" && (w.sport || "running") !== sportFilter) return false;
    return true;
  });

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    haptics.warning();
    if (confirm(t("workout.delete_confirm"))) {
      await deleteStoredWorkout(id);
      await loadCustomWorkouts();
      if (selectedWorkoutId === id) {
        onSelectWorkout(null);
      }
    }
  }

  async function handleDuplicate(workout: StructuredWorkout, e: React.MouseEvent) {
    e.stopPropagation();
    haptics.success();
    const copy: StructuredWorkout = {
      ...workout,
      id: `workout_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `${workout.name} (${t("workout.copy_suffix")})`,
      isPreset: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await putWorkout(copy);
    await loadCustomWorkouts();
  }

  function handleEdit(workout: StructuredWorkout, e: React.MouseEvent) {
    e.stopPropagation();
    haptics.light();
    setEditingWorkout(workout);
    setIsBuilderOpen(true);
  }

  return (
    <>
      <div className="fixed inset-0 z-[1050] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label={t("workout.library_title")}
          className="relative w-full max-w-2xl bg-[var(--color-surface-chart)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-[var(--border)] flex items-center justify-between gap-3 bg-[var(--color-surface-modal-header)]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-[var(--color-status-warning)]">
                <Zap size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--text)]">{t("workout.library_title")}</h3>
                <p className="text-xs text-[var(--muted)]">{t("workout.library_subtitle")}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                haptics.light();
                onClose();
              }}
              aria-label={language === "en" ? "Close modal" : "Fechar modal"}
              className="p-2 rounded-xl text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Sport Selector & Filter Tabs & New Button */}
          <div className="p-3 sm:px-5 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-2 bg-[var(--color-surface-modal-header)]/60 shrink-0">
            {/* Sport Filter */}
            <div className="flex items-center gap-1 bg-[var(--color-surface-github)] p-1 rounded-xl border border-[var(--border)] text-xs" role="group" aria-label={language === "en" ? "Workout filter" : "Filtro de treino"}>
              <button
                type="button"
                onClick={() => {
                  haptics.light();
                  setSportFilter("all");
                }}
                aria-pressed={sportFilter === "all"}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  sportFilter === "all"
                    ? "bg-[var(--surface-hover)] text-[var(--text)] shadow"
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                {t("workout.filter_all")}
              </button>
              <button
                type="button"
                onClick={() => {
                  haptics.light();
                  setSportFilter("running");
                }}
                aria-pressed={sportFilter === "running"}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
                  sportFilter === "running"
                    ? "bg-orange-500 text-black shadow"
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                <span>🏃</span>
                <span>{t("workout.filter_running")}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  haptics.light();
                  setSportFilter("cycling");
                }}
                aria-pressed={sportFilter === "cycling"}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
                  sportFilter === "cycling"
                    ? "bg-amber-500 text-black font-black shadow"
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                <span>🚴</span>
                <span>{t("workout.filter_cycling")}</span>
              </button>
            </div>

            {/* Presets vs Custom Tabs */}
            <div className="flex items-center gap-1 bg-[var(--color-surface-github)] p-1 rounded-xl border border-[var(--border)] text-xs" role="group" aria-label={language === "en" ? "Workout filter" : "Filtro de treino"}>
              <button
                type="button"
                onClick={() => {
                  haptics.light();
                  setFilterTab("all");
                }}
                aria-pressed={filterTab === "all"}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  filterTab === "all"
                    ? "bg-[var(--accent)] text-[var(--on-accent)] shadow"
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                {t("workout.filter_all")}
              </button>
              <button
                type="button"
                onClick={() => {
                  haptics.light();
                  setFilterTab("presets");
                }}
                aria-pressed={filterTab === "presets"}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  filterTab === "presets"
                    ? "bg-[var(--accent)] text-[var(--on-accent)] shadow"
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                {t("workout.filter_presets")}
              </button>
              <button
                type="button"
                onClick={() => {
                  haptics.light();
                  setFilterTab("custom");
                }}
                aria-pressed={filterTab === "custom"}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  filterTab === "custom"
                    ? "bg-[var(--accent)] text-[var(--on-accent)] shadow"
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                {t("workout.filter_custom")}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                haptics.light();
                setEditingWorkout(null);
                setIsBuilderOpen(true);
              }}
              className="btn-primary text-xs flex items-center gap-1 py-1.5 px-3"
            >
              <Plus size={15} />
              {t("workout.new_workout")}
            </button>
          </div>

          {/* Workouts List */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
            {/* Free Run / Ride Option */}
            <div
              role="button"
              tabIndex={0}
              aria-pressed={!selectedWorkoutId}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectWorkout(null);
                  onClose();
                }
              }}
              onClick={() => {
                haptics.medium();
                onSelectWorkout(null);
                onClose();
              }}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                !selectedWorkoutId
                  ? "bg-orange-500/10 border-orange-500/50 shadow-md"
                  : "bg-[var(--color-surface-github)]/70 border-[var(--border)] hover:border-[var(--border-strong)]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg bg-[var(--surface-hover)] flex items-center justify-center ${
                  !selectedWorkoutId ? "text-[var(--color-status-warning)]" : "text-[var(--muted)]"
                }`}>
                  <Navigation size={16} />
                </div>
                <div>
                  <h4 className={`text-sm font-bold ${
                    !selectedWorkoutId ? "text-[var(--text)]" : "text-[var(--text)]"
                  }`}>{t("workout.none")}</h4>
                  <p className={`text-xs ${
                    !selectedWorkoutId ? "text-[var(--muted)]" : "text-[var(--muted)]"
                  }`}>
                    {t("workout.free_run_desc")}
                  </p>
                </div>
              </div>
              {!selectedWorkoutId && (
                <span className="p-1 rounded-full bg-orange-500 text-black">
                  <Check size={14} />
                </span>
              )}
            </div>

            {displayedWorkouts.map((workout) => {
              const isSelected = selectedWorkoutId === workout.id;
              const summary = calculateWorkoutSummary(workout);
              const isCycling = workout.sport === "cycling";

              return (
                <div
                  key={workout.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectWorkout(workout);
                      onClose();
                    }
                  }}
                  onClick={() => {
                    haptics.medium();
                    onSelectWorkout(workout);
                    onClose();
                  }}
                  className={`p-4 rounded-xl border transition-all cursor-pointer space-y-3 ${
                    isSelected
                      ? "bg-orange-500/10 border-orange-500/60 shadow-lg ring-1 ring-orange-500/40"
                      : "bg-[var(--color-surface-github)]/80 border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--color-surface-modal-hover)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base">{isCycling ? "🚴" : "🏃"}</span>
                        <h3
                          className={`text-sm font-bold leading-tight ${
                            isSelected ? "text-[var(--text)]" : "text-[var(--text)]"
                          }`}
                        >
                          {workout.name}
                        </h3>
                        {workout.isPreset ? (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isSelected
                              ? "bg-amber-500/15 border border-amber-700/30 text-[var(--color-brand-accent-hover)]"
                              : "bg-amber-500/20 border border-amber-500/30 text-[var(--muted)]"
                          }`}>
                            {t("workout.preset_badge")}
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isSelected
                              ? "bg-purple-500/15 border border-purple-700/30 text-[var(--color-workout-repeat)]"
                              : "bg-purple-500/20 border border-purple-500/30 text-[var(--color-status-purple)]"
                          }`}>
                            {t("workout.custom_badge")}
                          </span>
                        )}
                        {isCycling && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            isSelected
                              ? "bg-amber-500/10 border border-amber-700/20 text-[var(--color-brand-accent-hover)]"
                              : "bg-amber-500/10 border border-amber-500/20 text-[var(--color-status-warning)]"
                          }`}>
                            {t("bike_hud.power_cadence")}
                          </span>
                        )}
                      </div>
                      {workout.description && (
                        <p className={`text-xs line-clamp-2 ${
                          isSelected ? "text-[var(--muted)]" : "text-[var(--muted)]"
                        }`}>
                          {workout.description}
                        </p>
                      )}
                    </div>

                    {isSelected && (
                      <span className="p-1 rounded-full bg-orange-500 text-black shrink-0">
                        <Check size={15} />
                      </span>
                    )}
                  </div>

                  {/* Visual Steps Dots preview */}
                  <div className="flex gap-1 h-2 rounded overflow-hidden bg-black/40 p-0.5">
                    {summary.flatSteps.map((item, idx) => {
                      const style = getStepTypeBadgeStyle(item.step.type);
                      return (
                        <div
                          key={idx}
                          className={`h-full rounded-sm flex-1 ${style.dotColor}`}
                          title={item.step.name || (language === "en" ? style.nameEn : style.namePt)}
                        />
                      );
                    })}
                  </div>

                  {/* Footer Meta & Actions */}
                  <div className={`flex items-center justify-between pt-1 text-xs border-t border-[var(--border)]/50 ${
                    isSelected ? "text-[var(--muted)]" : "text-[var(--muted)]"
                  }`}>
                    <div className="flex items-center gap-3">
                      <span>{t("workout.steps_count", { count: summary.totalSteps })}</span>
                      {summary.repeatsCount > 0 && (
                        <span className={`flex items-center gap-1 font-semibold ${
                          isSelected ? "text-[var(--color-workout-repeat)]" : "text-[var(--color-status-purple)]"
                        }`}>
                          <Repeat size={12} />
                          {t("workout.repeats_count_short", { count: summary.repeatsCount })}
                        </span>
                      )}
                      {summary.distanceBasedM > 0 && (
                        <span>{formatDistance(summary.distanceBasedM)}</span>
                      )}
                      {summary.timeBasedSec > 0 && (
                        <span>{formatDuration(summary.timeBasedSec)}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => handleDuplicate(workout, e)}
                        className={`p-1.5 rounded-lg hover:bg-[var(--surface-hover)] ${
                          isSelected ? "text-[var(--muted)] hover:text-[var(--text)]" : "text-[var(--muted)] hover:text-[var(--text)]"
                        }`}
                        title={t("workout.duplicate_workout")}
                        aria-label={t("workout.duplicate_workout")}
                      >
                        <Copy size={13} />
                      </button>

                      {!workout.isPreset && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => handleEdit(workout, e)}
                            className={`p-1.5 rounded-lg hover:bg-[var(--surface-hover)] ${
                          isSelected ? "text-[var(--muted)] hover:text-[var(--text)]" : "text-[var(--muted)] hover:text-[var(--text)]"
                        }`}
                            title={t("workout.edit_workout")}
                            aria-label={t("workout.edit_workout")}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(workout.id, e)}
                            className="p-1.5 text-[var(--color-status-danger)] hover:text-[var(--text)] rounded-lg hover:bg-rose-500/10"
                            title={t("workout.delete_workout")}
                            aria-label={t("workout.delete_workout")}
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {isBuilderOpen && (
        <WorkoutBuilderModal
          isOpen={isBuilderOpen}
          initialWorkout={editingWorkout}
          onClose={() => setIsBuilderOpen(false)}
          onSaved={async (saved) => {
            await loadCustomWorkouts();
            onSelectWorkout(saved);
          }}
        />
      )}
    </>
  );
}