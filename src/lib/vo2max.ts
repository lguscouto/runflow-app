import type {
  ActivitySummary,
  UserProfile,
  VO2MaxEstimate,
  VO2MaxCategory,
  RacePrediction,
  RaceDistanceId,
} from "./types";

export const STANDARD_RACE_DISTANCES: { id: RaceDistanceId; nameKey: string; distanceM: number }[] = [
  { id: "5k", nameKey: "race_predictor.distance_5k", distanceM: 5000 },
  { id: "10k", nameKey: "race_predictor.distance_10k", distanceM: 10000 },
  { id: "half_marathon", nameKey: "race_predictor.distance_half", distanceM: 21097.5 },
  { id: "marathon", nameKey: "race_predictor.distance_marathon", distanceM: 42195 },
];

/**
 * Calcula o VO2 Max pelo método da Razão de Frequência Cardíaca (Uth-Sørensen-Overgaard-Pedersen).
 * VO2 Max = 15.3 * (FC_max / FC_repouso)
 */
export function calculateVO2MaxFromHRRatio(maxHr: number, restingHr: number): number {
  if (maxHr <= 0 || restingHr <= 0 || restingHr >= maxHr) return 0;
  const raw = 15.3 * (maxHr / restingHr);
  return Math.round(Math.min(85, Math.max(20, raw)) * 10) / 10;
}

/**
 * Calcula o VO2 Max / VDOT de uma atividade de corrida individual.
 * Suporta o modelo de Eficiência de Corrida com FC e o modelo VDOT de Jack Daniels.
 */
export function calculateVO2MaxFromWorkout(
  distanceM: number,
  durationSec: number,
  avgHr?: number | null,
  maxHr?: number | null
): number | null {
  if (distanceM < 1000 || durationSec < 300) return null;

  const tMinutes = durationSec / 60;
  const vMPerMin = distanceM / tMinutes; // metros por minuto

  // 1. Se tiver FC média e FC máxima confiáveis (treino com pelo menos 65% FC máx)
  if (avgHr && maxHr && maxHr > 100 && avgHr > 80 && avgHr <= maxHr) {
    const hrPct = avgHr / maxHr;
    if (hrPct >= 0.65) {
      // Custo de oxigênio da velocidade: VO2 = 0.2 * v + 3.5 (ACSM metabolic equation)
      const vo2Cost = 0.2 * vMPerMin + 3.5;
      // %VO2max aproximado pela %FCmax: %VO2max = (%HRmax - 0.37) / 0.63 (Swain et al.)
      const vo2Pct = Math.max(0.4, Math.min(1.0, (hrPct - 0.37) / 0.63));
      const estimatedVo2Max = vo2Cost / vo2Pct;
      if (estimatedVo2Max >= 20 && estimatedVo2Max <= 85) {
        return Math.round(estimatedVo2Max * 10) / 10;
      }
    }
  }

  // 2. Fallback: Modelo Jack Daniels & Gilbert VDOT baseado em performance de corrida
  const vo2Cost = -4.60 + 0.182258 * vMPerMin + 0.000104 * Math.pow(vMPerMin, 2);
  const percentMax =
    0.8 +
    0.1894393 * Math.exp(-0.012778 * tMinutes) +
    0.2989558 * Math.exp(-0.1932605 * tMinutes);

  if (percentMax <= 0) return null;
  const vdot = vo2Cost / percentMax;

  if (vdot >= 20 && vdot <= 85) {
    return Math.round(vdot * 10) / 10;
  }

  return null;
}

/**
 * Classifica o nível de VO2 Max em categorias baseadas em tabelas do Cooper Institute / ACSM.
 */
export function classifyVO2Max(
  vo2: number,
  age: number = 30
): { category: VO2MaxCategory; labelKey: string; color: string; bgRgba: string } {
  // Ajuste suave por faixa etária
  const ageFactor = age > 30 ? (age - 30) * 0.35 : 0;
  const adjustedVo2 = vo2 + ageFactor;

  if (adjustedVo2 >= 55) {
    return {
      category: "superior",
      labelKey: "vo2max.category_superior",
      color: "#8b5cf6", // Purple / Violet
      bgRgba: "rgba(139, 92, 246, 0.15)",
    };
  }
  if (adjustedVo2 >= 48) {
    return {
      category: "excellent",
      labelKey: "vo2max.category_excellent",
      color: "#10b981", // Emerald Green
      bgRgba: "rgba(16, 185, 129, 0.15)",
    };
  }
  if (adjustedVo2 >= 41) {
    return {
      category: "good",
      labelKey: "vo2max.category_good",
      color: "#0ea5e9", // Sky Blue / Cyan
      bgRgba: "rgba(14, 165, 233, 0.15)",
    };
  }
  if (adjustedVo2 >= 35) {
    return {
      category: "fair",
      labelKey: "vo2max.category_fair",
      color: "#f59e0b", // Amber / Orange
      bgRgba: "rgba(245, 158, 11, 0.15)",
    };
  }
  return {
    category: "poor",
    labelKey: "vo2max.category_poor",
    color: "#ef4444", // Red
    bgRgba: "rgba(239, 68, 68, 0.15)",
  };
}

/**
 * Calcula a Idade de Condicionamento Físico (Fitness Age) comparando o VO2 Max com médias etárias.
 */
export function calculateFitnessAge(vo2: number, chronologicalAge: number = 30): number {
  if (vo2 <= 0) return chronologicalAge;
  
  // VO2Max médio de 45 para pessoas ativas aos 25 anos, caindo ~0.45 por ano
  const rawAge = Math.round(25 + (48 - vo2) / 0.45);
  const minAge = Math.max(18, chronologicalAge - 15);
  const maxAge = Math.min(80, chronologicalAge + 20);
  
  return Math.max(minAge, Math.min(maxAge, rawAge));
}

/**
 * Estima o VO2 Max consolidado do usuário analisando histórico recente de corridas e perfil.
 */
export function estimateUserVO2Max(
  activities: ActivitySummary[],
  profile?: UserProfile | null
): VO2MaxEstimate | null {
  const runningActs = activities.filter(
    (a) => a.sport === "running" && a.distanceM >= 1000 && a.durationSec >= 300
  );

  const chronologicalAge = profile?.age || 30;
  const maxHr = profile?.maxHr;
  const restingHr = profile?.restingHr;

  // 1. Tentar coletar amostras das últimas 10 corridas
  const samples: { vo2: number; weight: number; hasHr: boolean }[] = [];

  for (let i = 0; i < Math.min(10, runningActs.length); i++) {
    const act = runningActs[i];
    const duration = act.movingTimeSec || act.durationSec;
    const vo2 = calculateVO2MaxFromWorkout(act.distanceM, duration, act.avgHr, maxHr);
    if (vo2) {
      // Peso maior para corridas mais recentes e com FC
      const recencyWeight = 1 / (i + 1);
      const hrWeight = act.avgHr ? 1.5 : 1.0;
      samples.push({
        vo2,
        weight: recencyWeight * hrWeight,
        hasHr: !!act.avgHr,
      });
    }
  }

  let finalVo2: number | null = null;
  let method: VO2MaxEstimate["method"] = "estimated";
  let confidence: VO2MaxEstimate["confidence"] = "low";

  if (samples.length > 0) {
    const totalWeight = samples.reduce((acc, s) => acc + s.weight, 0);
    const weightedSum = samples.reduce((acc, s) => acc + s.vo2 * s.weight, 0);
    finalVo2 = Math.round((weightedSum / totalWeight) * 10) / 10;
    
    const hrSamples = samples.filter((s) => s.hasHr).length;
    if (hrSamples >= 3) {
      method = "heart_rate_running";
      confidence = "high";
    } else if (samples.length >= 2) {
      method = "vdot_performance";
      confidence = "medium";
    } else {
      method = "vdot_performance";
      confidence = "low";
    }
  } else if (maxHr && restingHr && maxHr > restingHr) {
    // Fallback: Razão de Frequência Cardíaca
    finalVo2 = calculateVO2MaxFromHRRatio(maxHr, restingHr);
    method = "hr_ratio";
    confidence = "medium";
  }

  if (!finalVo2) return null;

  const classification = classifyVO2Max(finalVo2, chronologicalAge);
  const fitnessAge = calculateFitnessAge(finalVo2, chronologicalAge);

  return {
    vo2Max: finalVo2,
    category: classification.category,
    fitnessAge,
    chronologicalAge,
    method,
    confidence,
    sampleCount: samples.length,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Calcula a previsão de tempo para 5K, 10K, Meia Maratona e Maratona usando a fórmula de Peter Riegel
 * calibrada com as melhores performances e VO2Max do usuário.
 */
export function calculateRacePredictions(
  activities: ActivitySummary[],
  profile?: UserProfile | null
): RacePrediction[] {
  const runningActs = activities.filter(
    (a) => a.sport === "running" && a.distanceM >= 1000 && a.durationSec >= 300
  );

  // Encontrar o treino de melhor performance relativa (menor ritmo por distância ponderada)
  let bestAct: ActivitySummary | null = null;
  let bestScore = Infinity;

  for (const act of runningActs) {
    const duration = act.movingTimeSec || act.durationSec;
    const paceSecKm = (duration / act.distanceM) * 1000;
    // Ponderar: corridas mais longas (ex: 5km a 5:00 são mais impressionantes que 1km a 5:00)
    // Usamos Riegel inverso para normalizar o tempo para equivalente de 5K
    const distRatio = 5000 / act.distanceM;
    const normalized5kTime = duration * Math.pow(distRatio, 1.06);
    
    if (normalized5kTime < bestScore) {
      bestScore = normalized5kTime;
      bestAct = act;
    }
  }

  // Se não houver atividade de corrida, usar um padrão amador realista (ex: 5k em 30min)
  const baseDistanceM = bestAct ? bestAct.distanceM : 5000;
  const baseDurationSec = bestAct ? (bestAct.movingTimeSec || bestAct.durationSec) : 1800; // 30 min

  return STANDARD_RACE_DISTANCES.map((target) => {
    // Pete Riegel formula: T2 = T1 * (D2 / D1)^1.06
    // Para distâncias muito longas (maratona) em corredores amadores, ligeiro decaimento aeróbico (1.075)
    const exponent = target.distanceM > 25000 ? 1.075 : 1.06;
    const predictedTimeSec = Math.round(
      baseDurationSec * Math.pow(target.distanceM / baseDistanceM, exponent)
    );
    const targetPaceSecKm = (predictedTimeSec / target.distanceM) * 1000;

    return {
      id: target.id,
      nameKey: target.nameKey,
      distanceM: target.distanceM,
      predictedTimeSec,
      targetPaceSecKm,
      baseActivityId: bestAct?.id,
      baseDistanceM,
    };
  });
}
