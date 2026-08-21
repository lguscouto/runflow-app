import type {
  FlatWorkoutStep,
  StructuredWorkout,
  WorkoutItem,
  WorkoutRepeatBlock,
  WorkoutStep,
  WorkoutStepType,
  WorkoutTargetType,
} from "./types";
import { formatDistance, formatDuration, formatPace } from "./format";

/**
 * Achata os itens de treino (incluindo blocos de repetição) em uma lista linear sequencial.
 */
export function flattenWorkoutItems(items: WorkoutItem[]): FlatWorkoutStep[] {
  const flattened: FlatWorkoutStep[] = [];
  let currentIndex = 0;

  for (const item of items) {
    if (item.type === "repeat") {
      const repeatBlock = item as WorkoutRepeatBlock;
      for (let r = 1; r <= repeatBlock.repeats; r++) {
        for (const step of repeatBlock.steps) {
          flattened.push({
            stepId: `${step.id}_r${r}`,
            blockId: repeatBlock.id,
            stepIndex: currentIndex++,
            totalSteps: 0, // será preenchido ao final
            repeatIndex: r,
            totalRepeats: repeatBlock.repeats,
            step,
          });
        }
      }
    } else {
      const singleStep = item as WorkoutStep;
      flattened.push({
        stepId: singleStep.id,
        stepIndex: currentIndex++,
        totalSteps: 0,
        step: singleStep,
      });
    }
  }

  const total = flattened.length;
  return flattened.map((item) => ({ ...item, totalSteps: total }));
}

/**
 * Calcula totais e estimativas de um treino estruturado.
 */
export function calculateWorkoutSummary(workout: StructuredWorkout) {
  const flatSteps = flattenWorkoutItems(workout.items);
  let distanceBasedM = 0;
  let timeBasedSec = 0;
  let workCount = 0;
  let repeatsCount = 0;

  for (const item of workout.items) {
    if (item.type === "repeat") {
      repeatsCount += item.repeats;
    }
  }

  for (const f of flatSteps) {
    if (f.step.type === "work") {
      workCount++;
    }
    if (f.step.targetType === "distance") {
      distanceBasedM += f.step.targetValue;
    } else if (f.step.targetType === "time") {
      timeBasedSec += f.step.targetValue;
    }
  }

  return {
    totalSteps: flatSteps.length,
    workCount,
    repeatsCount,
    distanceBasedM,
    timeBasedSec,
    flatSteps,
  };
}

/**
 * Formata o alvo do passo em texto legível (ex: "400 m", "01:30", "Livre / Lap").
 */
export function formatStepTargetDescription(
  targetType: WorkoutTargetType,
  targetValue: number,
  lang: "pt" | "en" = "pt"
): string {
  if (targetType === "distance") {
    return formatDistance(targetValue);
  }
  if (targetType === "time") {
    return formatDuration(targetValue);
  }
  return lang === "en" ? "Open / Manual Lap" : "Livre / Lap Manual";
}

/**
 * Formata a faixa de ritmo alvo do passo (ex: "4:15 - 4:35 /km").
 */
export function formatStepPaceRange(
  paceTarget?: { minPaceSecKm?: number; maxPaceSecKm?: number }
): string | null {
  if (!paceTarget) return null;
  const { minPaceSecKm, maxPaceSecKm } = paceTarget;
  if (minPaceSecKm && maxPaceSecKm) {
    const minStr = formatPace(minPaceSecKm).replace(" /km", "");
    const maxStr = formatPace(maxPaceSecKm).replace(" /km", "");
    return `${minStr} - ${maxStr} /km`;
  }
  if (minPaceSecKm) {
    return `< ${formatPace(minPaceSecKm)}`;
  }
  if (maxPaceSecKm) {
    return `> ${formatPace(maxPaceSecKm)}`;
  }
  return null;
}

/**
 * Retorna as cores CSS para cada tipo de passo.
 */
export function getStepTypeBadgeStyle(type: WorkoutStepType): {
  bg: string;
  text: string;
  border: string;
  dotColor: string;
  namePt: string;
  nameEn: string;
} {
  switch (type) {
    case "warmup":
      return {
        bg: "bg-amber-500/15",
        text: "text-amber-400",
        border: "border-amber-500/30",
        dotColor: "bg-amber-400",
        namePt: "Aquecimento",
        nameEn: "Warmup",
      };
    case "work":
      return {
        bg: "bg-rose-500/15",
        text: "text-rose-400",
        border: "border-rose-500/30",
        dotColor: "bg-rose-400",
        namePt: "Tiro / Trabalho",
        nameEn: "Work / Interval",
      };
    case "recovery":
      return {
        bg: "bg-emerald-500/15",
        text: "text-emerald-400",
        border: "border-emerald-500/30",
        dotColor: "bg-emerald-400",
        namePt: "Recuperação",
        nameEn: "Recovery",
      };
    case "cooldown":
      return {
        bg: "bg-sky-500/15",
        text: "text-sky-400",
        border: "border-sky-500/30",
        dotColor: "bg-sky-400",
        namePt: "Desaquecimento",
        nameEn: "Cooldown",
      };
  }
}

/**
 * Avalia se o passo executado atendeu a meta programada.
 */
export function evaluateStepTargetMet(
  step: WorkoutStep,
  stats: {
    durationSec: number;
    distanceM: number;
    avgPaceSecKm: number | null;
  }
): boolean {
  if (step.targetType === "distance") {
    // Pelo menos 90% da distância atingida
    if (stats.distanceM < step.targetValue * 0.9) return false;
  } else if (step.targetType === "time") {
    // Pelo menos 90% do tempo atingido
    if (stats.durationSec < step.targetValue * 0.9) return false;
  }

  // Se tiver meta de ritmo em tiro
  if (step.type === "work" && step.paceTarget && stats.avgPaceSecKm) {
    const { minPaceSecKm, maxPaceSecKm } = step.paceTarget;
    // Se o ritmo máximo tolerado existe e o corredor foi mais lento que isso + 15s de margem
    if (maxPaceSecKm && stats.avgPaceSecKm > maxPaceSecKm + 15) {
      return false;
    }
  }

  return true;
}