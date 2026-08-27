"use client";

import React, { useState } from "react";
import {
  X,
  Plus,
  Trash2,
  Repeat,
  Flame,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Check,
  Zap,
} from "lucide-react";
import type {
  StructuredWorkout,
  WorkoutItem,
  WorkoutRepeatBlock,
  WorkoutStep,
  WorkoutStepType,
  WorkoutTargetType,
  Sport,
} from "@/lib/types";
import {
  flattenWorkoutItems,
  getStepTypeBadgeStyle,
  formatStepTargetDescription,
  formatStepPaceRange,
} from "@/lib/structured-workout";
import { formatDistance, formatDuration } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { putWorkout } from "@/lib/storage";
import { haptics } from "@/lib/haptics";
import { useModalA11y } from "@/hooks/useModalA11y";

interface WorkoutBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (workout: StructuredWorkout) => void;
  initialWorkout?: StructuredWorkout | null;
}

export function WorkoutBuilderModal({
  isOpen,
  onClose,
  onSaved,
  initialWorkout,
}: WorkoutBuilderModalProps) {
  const { t, language } = useI18n();
  const { modalRef } = useModalA11y({ isOpen, onClose });

  const [name, setName] = useState(initialWorkout?.name || "");
  const [description, setDescription] = useState(initialWorkout?.description || "");
  const [sport, setSport] = useState<Sport>(initialWorkout?.sport || "running");
  const [items, setItems] = useState<WorkoutItem[]>(
    initialWorkout?.items || [
      {
        id: "step_warmup",
        type: "warmup",
        name: "Aquecimento",
        targetType: "distance",
        targetValue: 1000,
      },
      {
        id: "block_repeats",
        type: "repeat",
        repeats: 5,
        steps: [
          {
            id: "step_work",
            type: "work",
            name: "Tiro",
            targetType: "distance",
            targetValue: 400,
            paceTarget: { minPaceSecKm: 270, maxPaceSecKm: 300 },
          },
          {
            id: "step_rec",
            type: "recovery",
            name: "Recuperação",
            targetType: "time",
            targetValue: 90,
          },
        ],
      },
      {
        id: "step_cooldown",
        type: "cooldown",
        name: "Desaquecimento",
        targetType: "distance",
        targetValue: 1000,
      },
    ]
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  function generateId(prefix: string) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  }

  function handleAddStep(type: WorkoutStepType = "work") {
    const newStep: WorkoutStep = {
      id: generateId("step"),
      type,
      name: type === "work" ? "Tiro" : type === "recovery" ? "Recuperação" : type === "warmup" ? "Aquecimento" : "Desaquecimento",
      targetType: type === "recovery" ? "time" : "distance",
      targetValue: type === "recovery" ? 60 : 400,
    };
    setItems([...items, newStep]);
  }

  function handleAddRepeatBlock() {
    const newBlock: WorkoutRepeatBlock = {
      id: generateId("repeat"),
      type: "repeat",
      repeats: 4,
      steps: [
        {
          id: generateId("step_work"),
          type: "work",
          name: "Tiro",
          targetType: "distance",
          targetValue: 400,
          paceTarget: { minPaceSecKm: 270, maxPaceSecKm: 300 },
        },
        {
          id: generateId("step_rec"),
          type: "recovery",
          name: "Recuperação",
          targetType: "time",
          targetValue: 90,
        },
      ],
    };
    setItems([...items, newBlock]);
  }

  function handleRemoveItem(index: number) {
    haptics.warning();
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
  }

  function handleMoveItem(index: number, direction: "up" | "down") {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === items.length - 1)
    ) {
      return;
    }
    haptics.light();
    const updated = [...items];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setItems(updated);
  }

  function handleUpdateSingleStep(index: number, partial: Partial<WorkoutStep>) {
    const updated = [...items];
    const current = updated[index] as WorkoutStep;
    updated[index] = { ...current, ...partial };
    setItems(updated);
  }

  function handleUpdateRepeatBlock(
    blockIndex: number,
    partial: Partial<WorkoutRepeatBlock>
  ) {
    const updated = [...items];
    const current = updated[blockIndex] as WorkoutRepeatBlock;
    updated[blockIndex] = { ...current, ...partial };
    setItems(updated);
  }

  function handleAddStepToRepeat(blockIndex: number) {
    haptics.light();
    const updated = [...items];
    const block = updated[blockIndex] as WorkoutRepeatBlock;
    const newStep: WorkoutStep = {
      id: generateId("substep"),
      type: "work",
      name: "Tiro",
      targetType: "distance",
      targetValue: 400,
    };
    updated[blockIndex] = {
      ...block,
      steps: [...block.steps, newStep],
    };
    setItems(updated);
  }

  function handleRemoveSubstep(blockIndex: number, subIndex: number) {
    haptics.warning();
    const updated = [...items];
    const block = updated[blockIndex] as WorkoutRepeatBlock;
    const updatedSteps = [...block.steps];
    updatedSteps.splice(subIndex, 1);
    updated[blockIndex] = {
      ...block,
      steps: updatedSteps,
    };
    setItems(updated);
  }

  function handleUpdateSubstep(
    blockIndex: number,
    subIndex: number,
    partial: Partial<WorkoutStep>
  ) {
    const updated = [...items];
    const block = updated[blockIndex] as WorkoutRepeatBlock;
    const updatedSteps = [...block.steps];
    updatedSteps[subIndex] = { ...updatedSteps[subIndex], ...partial };
    updated[blockIndex] = {
      ...block,
      steps: updatedSteps,
    };
    setItems(updated);
  }

  async function handleSave() {
    if (!name.trim()) {
      haptics.error();
      setErrorMsg(language === "en" ? "Please enter a workout name." : "Por favor, informe o nome do treino.");
      return;
    }
    if (items.length === 0) {
      haptics.error();
      setErrorMsg(language === "en" ? "Add at least one step to the workout." : "Adicione pelo menos uma etapa ao treino.");
      return;
    }

    const newWorkout: StructuredWorkout = {
      id: initialWorkout?.id || generateId("workout"),
      name: name.trim(),
      description: description.trim() || undefined,
      sport,
      items,
      isPreset: false,
      createdAt: initialWorkout?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await putWorkout(newWorkout);
      haptics.success();
      onSaved(newWorkout);
      onClose();
    } catch (err) {
      haptics.error();
      console.error("Erro ao salvar treino:", err);
      setErrorMsg(language === "en" ? "Failed to save workout." : "Erro ao salvar treino.");
    }
  }

  const flattenedPreview = flattenWorkoutItems(items);

  return (
    <div className="fixed inset-0 z-[1100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={initialWorkout ? t("workout.edit_workout") : t("workout.builder_title")}
        className="relative w-full max-w-2xl bg-[var(--color-surface-chart)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--color-surface-github)]/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Zap size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--text)] leading-tight">
                {initialWorkout ? t("workout.edit_workout") : t("workout.builder_title")}
              </h2>
              <p className="text-xs text-[var(--muted)]">{t("workout.subtitle")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={language === "en" ? "Close modal" : "Fechar modal"}
            className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-[var(--color-status-danger)] text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Name & Description */}
          <div className="space-y-3">
            <div>
              <label htmlFor="workout-name" className="block text-xs font-semibold text-[var(--muted)] mb-1">
                {t("workout.name_label")} *
              </label>
              <input
                id="workout-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("workout.name_placeholder")}
                className="w-full bg-[var(--color-surface-github)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>

            <div>
              <label htmlFor="workout-description" className="block text-xs font-semibold text-[var(--muted)] mb-1">
                {t("workout.desc_label")}
              </label>
              <input
                id="workout-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("workout.description_placeholder")}
                className="w-full bg-[var(--color-surface-github)] border border-[var(--border)] rounded-xl px-3.5 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
          </div>

          {/* Visual Step Sequence Bar */}
          {flattenedPreview.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                <span className="font-semibold flex items-center gap-1">
                  <Sparkles size={13} className="text-[var(--color-status-warning)]" />
                  {t("workout.profile_summary", { count: flattenedPreview.length })}
                </span>
              </div>
              <div className="flex gap-1 h-3 rounded-lg overflow-hidden bg-[var(--surface-hover)] p-0.5 border border-[var(--border)]">
                {flattenedPreview.map((item, idx) => {
                  const style = getStepTypeBadgeStyle(item.step.type);
                  return (
                    <div
                      key={idx}
                      className={`h-full rounded-sm flex-1 ${style.dotColor}`}
                      title={`${item.step.name || style.namePt} (${formatStepTargetDescription(item.step.targetType, item.step.targetValue, language)})`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Step Items List */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-[var(--text)] uppercase tracking-wider">
              {t("workout.steps_section")}
            </label>

            {items.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-[var(--border)] text-xs text-[var(--muted)]">
                {t("workout.no_steps")}
              </div>
            ) : (
              items.map((item, index) => {
                if (item.type === "repeat") {
                  const block = item as WorkoutRepeatBlock;
                  return (
                    <div
                      key={block.id}
                      className="p-3 sm:p-4 rounded-xl bg-purple-500/5 border border-purple-500/25 space-y-3 relative group"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-purple-500/20 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 rounded-lg bg-purple-500/20 text-[var(--color-workout-repeat)]">
                            <Repeat size={15} />
                          </span>
                          <span className="text-xs font-bold text-[var(--color-workout-repeat)]">
                            {t("workout.repeat_block")}
                          </span>
                          <div className="flex items-center gap-1.5 ml-2">
                            <span className="text-xs text-[var(--muted)]">{t("workout.repeat_label")}</span>
                            <select
                              aria-label={language === "en" ? "Number of repeats" : "Número de repetições"}
                              value={block.repeats}
                              onChange={(e) =>
                                handleUpdateRepeatBlock(index, {
                                  repeats: parseInt(e.target.value, 10),
                                })
                              }
                              className="bg-[var(--color-surface-github)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs text-[var(--text)] focus:outline-none"
                            >
                              {[2, 3, 4, 5, 6, 8, 10, 12, 15, 20].map((num) => (
                                <option key={num} value={num}>
                                  {t("workout.times", { count: num })}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Reorder and Delete */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveItem(index, "up")}
                            disabled={index === 0}
                            aria-label={language === "en" ? "Move step up" : "Mover etapa para cima"}
                            className={`p-1 ${
                            items[index].type === "repeat"
                              ? "text-[var(--muted)] hover:text-[var(--text)]"
                              : "text-[var(--muted)] hover:text-[var(--text)]"
                          } disabled:opacity-30`}
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveItem(index, "down")}
                            disabled={index === items.length - 1}
                            aria-label={language === "en" ? "Move step down" : "Mover etapa para baixo"}
                            className={`p-1 ${
                            items[index].type === "repeat"
                              ? "text-[var(--muted)] hover:text-[var(--text)]"
                              : "text-[var(--muted)] hover:text-[var(--text)]"
                          } disabled:opacity-30`}
                          >
                            <ArrowDown size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            aria-label={language === "en" ? "Remove step" : "Remover etapa"}
                            className="p-1 text-[var(--color-status-danger)] hover:text-[var(--color-status-danger)]"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Sub-steps in repeat block */}
                      <div className="space-y-2 pl-2 sm:pl-3 border-l-2 border-purple-500/30">
                        {block.steps.map((subStep, subIdx) => {
                          const badge = getStepTypeBadgeStyle(subStep.type);
                          return (
                            <div
                              key={subStep.id}
                              className="p-2.5 rounded-lg bg-[var(--color-surface-github)]/90 border border-[var(--border)] flex flex-wrap items-center justify-between gap-2"
                              style={{
                                "--color-workout-warmup": "#fbbf24",
                                "--color-workout-work": "#fb7185",
                                "--color-workout-recovery": "#34d399",
                                "--color-workout-cooldown": "#38bdf8",
                                "--color-workout-repeat": "#c084fc",
                              } as React.CSSProperties}
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <select
                                  aria-label={language === "en" ? "Step type" : "Tipo de etapa"}
                                  value={subStep.type}
                                  onChange={(e) =>
                                    handleUpdateSubstep(index, subIdx, {
                                      type: e.target.value as WorkoutStepType,
                                    })
                                  }
                                  className={`text-xs font-semibold px-2 py-1 rounded-md border ${badge.bg} ${badge.text} ${badge.border} focus:outline-none`}
                                >
                                  <option value="work">{t("workout.type_work")}</option>
                                  <option value="recovery">{t("workout.type_recovery")}</option>
                                  <option value="warmup">{t("workout.type_warmup")}</option>
                                  <option value="cooldown">{t("workout.type_cooldown")}</option>
                                </select>

                                {/* Target Type & Value */}
                                <select
                                  aria-label={language === "en" ? "Step target type" : "Tipo de meta da etapa"}
                                  value={subStep.targetType}
                                  onChange={(e) =>
                                    handleUpdateSubstep(index, subIdx, {
                                      targetType: e.target.value as WorkoutTargetType,
                                      targetValue: e.target.value === "distance" ? 400 : 90,
                                    })
                                  }
                                  className="text-xs bg-[var(--color-surface-chart)] border border-[var(--border)] text-[var(--text)] px-2 py-1 rounded-md"
                                >
                                  <option value="distance">{t("workout.target_distance_m")}</option>
                                  <option value="time">{t("workout.target_time_s")}</option>
                                  <option value="open">{t("workout.target_open_lap")}</option>
                                </select>

                                {subStep.targetType !== "open" && (
                                  <input
                                    aria-label={language === "en" ? "Step target value" : "Valor da meta da etapa"}
                                    type="number"
                                    value={subStep.targetValue}
                                    onChange={(e) =>
                                      handleUpdateSubstep(index, subIdx, {
                                        targetValue: Math.max(1, parseInt(e.target.value, 10) || 0),
                                      })
                                    }
                                    className="w-20 text-xs bg-[var(--color-surface-chart)] border border-[var(--border)] text-[var(--text)] px-2 py-1 rounded-md"
                                    placeholder={t("workout.value_placeholder")}
                                  />
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveSubstep(index, subIdx)}
                                aria-label={language === "en" ? "Remove repeat step" : "Remover etapa da série"}
                                className="p-1 text-rose-400 hover:text-rose-300"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => handleAddStepToRepeat(index)}
                          className="text-xs text-[var(--color-workout-repeat)] hover:opacity-80 flex items-center gap-1 font-semibold pt-1"
                        >
                          <Plus size={13} />
                          {t("workout.add_step_inside_label")}
                        </button>
                      </div>
                    </div>
                  );
                }

                // Single Step
                const step = item as WorkoutStep;
                const badge = getStepTypeBadgeStyle(step.type);

                return (
                  <div
                    key={step.id}
                    className="p-3 sm:p-3.5 rounded-xl bg-[var(--color-surface-github)]/70 border border-[var(--border)] space-y-2.5 text-[var(--text)]"
                    style={{
                      "--color-workout-warmup": "#fbbf24",
                      "--color-workout-work": "#fb7185",
                      "--color-workout-recovery": "#34d399",
                      "--color-workout-cooldown": "#38bdf8",
                      "--color-workout-repeat": "#c084fc",
                    } as React.CSSProperties}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Step Type Selector */}
                        <select
                          aria-label={language === "en" ? "Step type" : "Tipo de etapa"}
                          value={step.type}
                          onChange={(e) =>
                            handleUpdateSingleStep(index, {
                              type: e.target.value as WorkoutStepType,
                            })
                          }
                          className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${badge.bg} ${badge.text} ${badge.border} focus:outline-none`}
                        >
                          <option value="warmup">{t("workout.type_warmup")}</option>
                          <option value="work">{t("workout.type_work")}</option>
                          <option value="recovery">{t("workout.type_recovery")}</option>
                          <option value="cooldown">{t("workout.type_cooldown")}</option>
                        </select>

                        {/* Name Input */}
                        <input
                          aria-label={language === "en" ? "Step name" : "Nome da etapa"}
                          type="text"
                          value={step.name || ""}
                          onChange={(e) =>
                            handleUpdateSingleStep(index, { name: e.target.value })
                          }
                          placeholder={t("workout.step_name_placeholder")}
                          className="text-xs bg-[var(--color-surface-chart)] border border-[var(--border)] text-[var(--text)] px-2 py-1 rounded-lg w-32 sm:w-40"
                        />
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveItem(index, "up")}
                          disabled={index === 0}
                          aria-label={language === "en" ? "Move step up" : "Mover etapa para cima"}
                          className={`p-1 ${
                            items[index].type === "repeat"
                              ? "text-[var(--muted)] hover:text-[var(--text)]"
                              : "text-[var(--muted)] hover:text-[var(--text)]"
                          } disabled:opacity-30`}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveItem(index, "down")}
                          disabled={index === items.length - 1}
                          aria-label={language === "en" ? "Move step down" : "Mover etapa para baixo"}
                          className={`p-1 ${
                            items[index].type === "repeat"
                              ? "text-[var(--muted)] hover:text-[var(--text)]"
                              : "text-[var(--muted)] hover:text-[var(--text)]"
                          } disabled:opacity-30`}
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          aria-label={language === "en" ? "Remove step" : "Remover etapa"}
                          className="p-1 text-rose-400 hover:text-rose-300"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Target Config Row */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-[var(--muted)]">{t("workout.target_label")}</span>
                      <select
                        aria-label={language === "en" ? "Target type" : "Tipo de meta"}
                        value={step.targetType}
                        onChange={(e) =>
                          handleUpdateSingleStep(index, {
                            targetType: e.target.value as WorkoutTargetType,
                            targetValue: e.target.value === "distance" ? 1000 : 300,
                          })
                        }
                        className="bg-[var(--color-surface-chart)] border border-[var(--border)] text-[var(--text)] px-2 py-1 rounded-lg"
                      >
                        <option value="distance">{t("workout.target_distance_meters")}</option>
                        <option value="time">{t("workout.target_time_seconds")}</option>
                        <option value="open">{t("workout.target_open_manual_lap")}</option>
                      </select>

                      {step.targetType !== "open" && (
                        <div className="flex items-center gap-1">
                          <input
                            aria-label={language === "en" ? "Target value" : "Valor da meta"}
                            type="number"
                            value={step.targetValue}
                            onChange={(e) =>
                              handleUpdateSingleStep(index, {
                                targetValue: Math.max(1, parseInt(e.target.value, 10) || 0),
                              })
                            }
                            className="w-24 bg-[var(--color-surface-chart)] border border-[var(--border)] text-[var(--text)] px-2 py-1 rounded-lg"
                          />
                          <span className="text-[var(--muted)]">
                            {step.targetType === "distance" ? "m" : t("workout.unit_seconds_short")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Add Actions Row */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleAddStep("work")}
              className="btn-ghost text-xs flex items-center gap-1 text-[var(--accent)] border-[var(--accent)]/30 hover:border-[var(--accent)]"
            >
              <Plus size={14} />
              {t("workout.add_step")}
            </button>
            <button
              type="button"
              onClick={handleAddRepeatBlock}
              className="btn-ghost text-xs flex items-center gap-1 text-[var(--color-workout-repeat)] border-purple-500/30 hover:border-purple-500"
            >
              <Repeat size={14} />
              {t("workout.add_repeat")}
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[var(--border)] bg-[var(--color-surface-github)]/70 flex items-center justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="btn-ghost text-xs text-[var(--muted)] hover:text-[var(--text)]">
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <Check size={16} />
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}