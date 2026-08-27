import type {
  FlatWorkoutStep,
  PowerZoneId,
  StructuredWorkout,
  WorkoutCadenceTarget,
  WorkoutItem,
  WorkoutPowerTarget,
  WorkoutRepeatBlock,
  WorkoutStep,
  WorkoutStepType,
  WorkoutTargetType,
} from "./types";
import { formatDistance, formatDuration, formatPace, formatWatts } from "./format";
import { calculatePowerZones, DEFAULT_FTP_WATTS } from "./power-zones";

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
 * Resolve e calcula a faixa de Watts do passo com base no FTP do ciclista.
 */
export function resolveStepPowerTargetWatts(
  step: WorkoutStep,
  userFtp: number = DEFAULT_FTP_WATTS
): { minWatts: number; maxWatts: number; label: string; zone?: PowerZoneId } | null {
  const ftp = Math.max(40, userFtp);
  const powerTarget = step.powerTarget;
  const pZoneTarget = step.powerZoneTarget || powerTarget?.powerZoneTarget;
  const pFtpTarget = powerTarget?.percentFtpTarget;

  // 1. Faixa direta em Watts
  if (powerTarget?.minWatts != null || powerTarget?.maxWatts != null) {
    const minW = powerTarget.minWatts || 0;
    const maxW = powerTarget.maxWatts || (powerTarget.targetWatts ? Math.round(powerTarget.targetWatts * 1.1) : 9999);
    return {
      minWatts: minW,
      maxWatts: maxW,
      label: minW > 0 && maxW < 9999 ? `${minW} - ${maxW} W` : maxW < 9999 ? `< ${maxW} W` : `> ${minW} W`,
      zone: pZoneTarget,
    };
  }

  // 2. Porcentagem do FTP (ex: 88-94% FTP)
  if (pFtpTarget?.minPct != null || pFtpTarget?.maxPct != null) {
    const minPct = (pFtpTarget.minPct ?? 50) / 100;
    const maxPct = (pFtpTarget.maxPct ?? 150) / 100;
    const minWatts = Math.round(ftp * minPct);
    const maxWatts = Math.round(ftp * maxPct);
    return {
      minWatts,
      maxWatts,
      label: `${minWatts} - ${maxWatts} W (${pFtpTarget.minPct}%-${pFtpTarget.maxPct}% FTP)`,
      zone: pZoneTarget,
    };
  }

  // 3. Zona de Coggan (Z1 a Z7)
  if (pZoneTarget != null && pZoneTarget >= 1 && pZoneTarget <= 7) {
    const zones = calculatePowerZones(ftp);
    const zone = zones.find((z) => z.zone === pZoneTarget);
    if (zone) {
      return {
        minWatts: zone.minWatts,
        maxWatts: zone.maxWatts,
        label: `Z${zone.zone} (${zone.minWatts} - ${zone.maxWatts < 9000 ? `${zone.maxWatts} W` : "W+"})`,
        zone: pZoneTarget,
      };
    }
  }

  return null;
}

/**
 * Formata a meta de cadência de pedalada em texto legível (ex: "85 - 95 RPM").
 */
export function formatStepCadenceRange(
  cadenceTarget?: WorkoutCadenceTarget
): string | null {
  if (!cadenceTarget) return null;
  const { minCadenceRpm, maxCadenceRpm, targetCadenceRpm } = cadenceTarget;
  if (minCadenceRpm && maxCadenceRpm) {
    return `${minCadenceRpm} - ${maxCadenceRpm} RPM`;
  }
  if (targetCadenceRpm) {
    return `~${targetCadenceRpm} RPM`;
  }
  if (minCadenceRpm) {
    return `> ${minCadenceRpm} RPM`;
  }
  if (maxCadenceRpm) {
    return `< ${maxCadenceRpm} RPM`;
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
        text: "text-[var(--color-workout-warmup)]",
        border: "border-amber-500/30",
        dotColor: "bg-amber-400",
        namePt: "Aquecimento",
        nameEn: "Warmup",
      };
    case "work":
      return {
        bg: "bg-rose-500/15",
        text: "text-[var(--color-workout-work)]",
        border: "border-rose-500/30",
        dotColor: "bg-rose-400",
        namePt: "Tiro / Trabalho",
        nameEn: "Work / Interval",
      };
    case "recovery":
      return {
        bg: "bg-emerald-500/15",
        text: "text-[var(--color-workout-recovery)]",
        border: "border-emerald-500/30",
        dotColor: "bg-emerald-400",
        namePt: "Recuperação",
        nameEn: "Recovery",
      };
    case "cooldown":
      return {
        bg: "bg-sky-500/15",
        text: "text-[var(--color-workout-cooldown)]",
        border: "border-sky-500/30",
        dotColor: "bg-sky-400",
        namePt: "Desaquecimento",
        nameEn: "Cooldown",
      };
  }
}

/**
 * Avalia se o passo executado atendeu a meta programada (distância, tempo, ritmo, potência, cadência).
 */
export function evaluateStepTargetMet(
  step: WorkoutStep,
  stats: {
    durationSec: number;
    distanceM: number;
    avgPaceSecKm: number | null;
    avgWatts?: number | null;
    avgCadenceRpm?: number | null;
  },
  userFtp: number = DEFAULT_FTP_WATTS
): boolean {
  if (step.targetType === "distance") {
    // Pelo menos 90% da distância atingida
    if (stats.distanceM < step.targetValue * 0.9) return false;
  } else if (step.targetType === "time") {
    // Pelo menos 90% do tempo atingido
    if (stats.durationSec < step.targetValue * 0.9) return false;
  }

  // Se tiver meta de ritmo em corrida
  if (step.type === "work" && step.paceTarget && stats.avgPaceSecKm) {
    const { maxPaceSecKm } = step.paceTarget;
    if (maxPaceSecKm && stats.avgPaceSecKm > maxPaceSecKm + 15) {
      return false;
    }
  }

  // Se tiver meta de potência em ciclismo
  const resolvedPower = resolveStepPowerTargetWatts(step, userFtp);
  if (step.type === "work" && resolvedPower && stats.avgWatts && stats.avgWatts > 0) {
    // Tolera até 15% abaixo do mínimo alvo em tiros de ciclismo
    if (stats.avgWatts < resolvedPower.minWatts * 0.85) {
      return false;
    }
  }

  // Se tiver meta de cadência em ciclismo
  if (step.cadenceTarget?.minCadenceRpm && stats.avgCadenceRpm && stats.avgCadenceRpm > 0) {
    if (stats.avgCadenceRpm < step.cadenceTarget.minCadenceRpm - 10) {
      return false;
    }
  }

  return true;
}