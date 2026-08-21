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
} from "lucide-react";
import type { StructuredWorkout } from "@/lib/types";
import { BUILTIN_WORKOUT_PRESETS } from "@/lib/workout-presets";
import { getAllStoredWorkouts, deleteStoredWorkout, putWorkout } from "@/lib/storage";
import {
  calculateWorkoutSummary,
  getStepTypeBadgeStyle,
  formatStepTargetDescription,
} from "@/lib/structured-workout";
import { formatDistance, formatDuration } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { WorkoutBuilderModal } from "./WorkoutBuilderModal";

interface WorkoutLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWorkout: (workout: StructuredWorkout | null) => void;
  selectedWorkoutId?: string | null;
}

export function WorkoutLibraryModal({
  isOpen,
  onClose,
  onSelectWorkout,
  selectedWorkoutId,
}: WorkoutLibraryModalProps) {
  const { t, language } = useI18n();

  const [filterTab, setFilterTab] = useState<"all" | "presets" | "custom">("all");
  const [customWorkouts, setCustomWorkouts] = useState<StructuredWorkout[]>([]);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<StructuredWorkout | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCustomWorkouts();
    }
  }, [isOpen]);

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
    if (filterTab === "presets") return w.isPreset;
    if (filterTab === "custom") return !w.isPreset;
    return true;
  });

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
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
    const copy: StructuredWorkout = {
      ...workout,
      id: `workout_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `${workout.name} (${language === "en" ? "Copy" : "Cópia"})`,
      isPreset: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await putWorkout(copy);
    await loadCustomWorkouts();
  }

  function handleEdit(workout: StructuredWorkout, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingWorkout(workout);
    setIsBuilderOpen(true);
  }

  return (
    <>
      <div className="fixed inset-0 z-[1050] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <div className="relative w-full max-w-2xl bg-[#0f141c] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-[var(--border)] flex items-center justify-between bg-[#161b22]/70 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
                <Flame size={20} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                  {t("workout.library_title")}
                </h2>
                <p className="text-xs text-[var(--muted)]">{t("workout.subtitle")}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--muted)] hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Filter Tabs & New Button */}
          <div className="p-3 sm:px-5 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-2 bg-[#121720]/60 shrink-0">
            <div className="flex items-center gap-1 bg-[#161b22] p-1 rounded-xl border border-[var(--border)] text-xs">
              <button
                type="button"
                onClick={() => setFilterTab("all")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filterTab === "all"
                    ? "bg-[var(--accent)] text-white shadow"
                    : "text-[var(--muted)] hover:text-white"
                }`}
              >
                Todos ({allWorkouts.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("presets")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filterTab === "presets"
                    ? "bg-[var(--accent)] text-white shadow"
                    : "text-[var(--muted)] hover:text-white"
                }`}
              >
                Oficiais ({BUILTIN_WORKOUT_PRESETS.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("custom")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filterTab === "custom"
                    ? "bg-[var(--accent)] text-white shadow"
                    : "text-[var(--muted)] hover:text-white"
                }`}
              >
                Meus Treinos ({customWorkouts.length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
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
            {/* Free Run Option */}
            <div
              onClick={() => {
                onSelectWorkout(null);
                onClose();
              }}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                !selectedWorkoutId
                  ? "bg-orange-500/10 border-orange-500/50 shadow-md"
                  : "bg-[#161b22]/70 border-[var(--border)] hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[var(--muted)]">
                  <Navigation size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{t("workout.none")}</h4>
                  <p className="text-xs text-[var(--muted)]">
                    Gravação padrão com GPS e cronômetro contínuo.
                  </p>
                </div>
              </div>
              {!selectedWorkoutId && (
                <span className="p-1 rounded-full bg-orange-500 text-white">
                  <Check size={14} />
                </span>
              )}
            </div>

            {displayedWorkouts.map((workout) => {
              const isSelected = selectedWorkoutId === workout.id;
              const summary = calculateWorkoutSummary(workout);

              return (
                <div
                  key={workout.id}
                  onClick={() => {
                    onSelectWorkout(workout);
                    onClose();
                  }}
                  className={`p-4 rounded-xl border transition-all cursor-pointer space-y-3 ${
                    isSelected
                      ? "bg-orange-500/10 border-orange-500/60 shadow-lg ring-1 ring-orange-500/40"
                      : "bg-[#161b22]/80 border-[var(--border)] hover:border-white/20 hover:bg-[#1a202c]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-white leading-tight">
                          {workout.name}
                        </h3>
                        {workout.isPreset ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 border border-amber-500/30 text-amber-300">
                            {t("workout.preset_badge")}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 border border-purple-500/30 text-purple-300">
                            {t("workout.custom_badge")}
                          </span>
                        )}
                      </div>
                      {workout.description && (
                        <p className="text-xs text-[var(--muted)] line-clamp-2">
                          {workout.description}
                        </p>
                      )}
                    </div>

                    {isSelected && (
                      <span className="p-1 rounded-full bg-orange-500 text-white shrink-0">
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
                          title={`${item.step.name || style.namePt}`}
                        />
                      );
                    })}
                  </div>

                  {/* Footer Meta & Actions */}
                  <div className="flex items-center justify-between pt-1 text-xs text-[var(--muted)] border-t border-[var(--border)]/50">
                    <div className="flex items-center gap-3">
                      <span>{summary.totalSteps} etapas</span>
                      {summary.repeatsCount > 0 && (
                        <span className="flex items-center gap-1 text-purple-400">
                          <Repeat size={12} />
                          {summary.repeatsCount} séries
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
                        className="p-1.5 text-[var(--muted)] hover:text-white rounded-lg hover:bg-white/10"
                        title={t("workout.duplicate_workout")}
                      >
                        <Copy size={13} />
                      </button>

                      {!workout.isPreset && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => handleEdit(workout, e)}
                            className="p-1.5 text-[var(--muted)] hover:text-white rounded-lg hover:bg-white/10"
                            title={t("workout.edit_workout")}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(workout.id, e)}
                            className="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-500/10"
                            title={t("workout.delete_workout")}
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