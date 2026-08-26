import { haversineM } from "./geo";
import type { ClimbCategory, ClimbSegment, ClimbProgressState, RoutePoint } from "./types";
import { requireElevationConsent } from "./external-privacy";
import { colorTokens } from "./color-tokens";

/**
 * Aplica suavização com média móvel para eliminar ruídos de barômetro/GPS.
 */
export function smoothElevations(elevations: number[], windowSize: number = 5): number[] {
  if (elevations.length <= windowSize) return [...elevations];
  const half = Math.floor(windowSize / 2);
  const result: number[] = [];

  for (let i = 0; i < elevations.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(elevations.length - 1, i + half);
    let sum = 0;
    let count = 0;
    for (let j = start; j <= end; j++) {
      sum += elevations[j];
      count++;
    }
    result.push(sum / count);
  }

  return result;
}

/**
 * Classifica uma subida segundo as fórmulas oficiais UCI / Climb Score.
 * Climb Score = Distância (m) * Inclinação Média (%)
 */
export function classifyClimb(
  distanceM: number,
  avgGradePct: number,
  elevationGainM: number
): { category: ClimbCategory; climbScore: number } {
  const safeAvgGrade = Math.max(0, avgGradePct);
  const climbScore = Math.round(distanceM * safeAvgGrade);

  // Regras padrão UCI / Strava / Garmin ClimbPro
  if (climbScore >= 80000 || (elevationGainM >= 600 && distanceM >= 7000)) {
    return { category: "HC", climbScore };
  }
  if (climbScore >= 64000 || (elevationGainM >= 400 && distanceM >= 4000)) {
    return { category: "Cat 1", climbScore };
  }
  if (climbScore >= 32000 || (elevationGainM >= 250 && distanceM >= 2500)) {
    return { category: "Cat 2", climbScore };
  }
  if (climbScore >= 16000 || (elevationGainM >= 120 && distanceM >= 1200)) {
    return { category: "Cat 3", climbScore };
  }
  if (climbScore >= 8000 || (elevationGainM >= 50 && distanceM >= 500)) {
    return { category: "Cat 4", climbScore };
  }

  return { category: "Uncategorized", climbScore };
}

/**
 * Retorna a cor característica de inclinação (estilo Garmin / Karoo).
 */
export function getGradeColor(gradePct: number): string {
  if (gradePct < 0) return colorTokens.grade.downhill; // Azul claro (Descida)
  if (gradePct < 3) return colorTokens.grade.flat; // Verde (0 - 3% Plano / Falso plano)
  if (gradePct < 6) return colorTokens.grade.moderate; // Amarelo (3 - 6% Moderado)
  if (gradePct < 9) return colorTokens.grade.steep; // Laranja (6 - 9% Inclinado)
  if (gradePct < 12) return colorTokens.grade.verySteep; // Vermelho (9 - 12% Íngreme)
  return colorTokens.grade.extreme; // Roxo (12%+ Parede / Extremo)
}

/**
 * Retorna estilo de badge visual para cada categoria de subida.
 */
export function getCategoryBadgeStyle(category: ClimbCategory): {
  label: string;
  bg: string;
  text: string;
  border: string;
  badgeBg: string;
} {
  switch (category) {
    case "HC":
      return {
        label: "HC",
        bg: "bg-purple-500/20",
        text: "text-purple-400",
        border: "border-purple-500/40",
        badgeBg: colorTokens.climbCategories.hc,
      };
    case "Cat 1":
      return {
        label: "CAT 1",
        bg: "bg-rose-500/20",
        text: "text-rose-400",
        border: "border-rose-500/40",
        badgeBg: colorTokens.climbCategories.cat1,
      };
    case "Cat 2":
      return {
        label: "CAT 2",
        bg: "bg-orange-500/20",
        text: "text-orange-400",
        border: "border-orange-500/40",
        badgeBg: colorTokens.climbCategories.cat2,
      };
    case "Cat 3":
      return {
        label: "CAT 3",
        bg: "bg-amber-500/20",
        text: "text-amber-400",
        border: "border-amber-500/40",
        badgeBg: colorTokens.climbCategories.cat3,
      };
    case "Cat 4":
      return {
        label: "CAT 4",
        bg: "bg-emerald-500/20",
        text: "text-emerald-400",
        border: "border-emerald-500/40",
        badgeBg: colorTokens.climbCategories.cat4,
      };
    default:
      return {
        label: "RAMPA",
        bg: "bg-blue-500/20",
        text: "text-blue-400",
        border: "border-blue-500/40",
        badgeBg: colorTokens.climbCategories.uncategorized,
      };
  }
}

/**
 * Detecta e categoriza todas as subidas em um trajeto/rota com coordenadas e altitudes.
 */
export function detectClimbs(
  points: Array<{ lat: number; lng: number; elevation?: number }>
): ClimbSegment[] {
  if (!points || points.length < 5) return [];

  // Verificar se há altitudes válidas
  const hasElevation = points.some((p) => typeof p.elevation === "number" && !isNaN(p.elevation));
  if (!hasElevation) return [];

  // Calcular distâncias acumuladas
  const distancesM: number[] = [0];
  let totalDist = 0;
  for (let i = 1; i < points.length; i++) {
    const d = haversineM(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
    totalDist += d;
    distancesM.push(totalDist);
  }

  // Preencher e suavizar altitudes
  const rawElevations = points.map((p) => p.elevation ?? 0);
  const smoothedElev = smoothElevations(rawElevations, 5);

  const rawClimbs: Array<{ startIndex: number; endIndex: number }> = [];
  let inClimb = false;
  let climbStartIndex = 0;
  let peakIndex = 0;
  let peakElev = -Infinity;

  for (let i = 1; i < points.length; i++) {
    const distDelta = distancesM[i] - distancesM[i - 1];
    if (distDelta <= 0) continue;

    const elevDelta = smoothedElev[i] - smoothedElev[i - 1];
    const segmentGrade = (elevDelta / distDelta) * 100;

    if (!inClimb) {
      // Inicia potencial subida se inclinação positiva >= 2.0%
      if (segmentGrade >= 2.0) {
        inClimb = true;
        climbStartIndex = i - 1;
        peakIndex = i;
        peakElev = smoothedElev[i];
      }
    } else {
      if (smoothedElev[i] > peakElev) {
        peakElev = smoothedElev[i];
        peakIndex = i;
      }

      // Critério de fim de subida: descida superior a 18m ou 250m contínuos sem ganho
      const distFromPeak = distancesM[i] - distancesM[peakIndex];
      const elevLossFromPeak = peakElev - smoothedElev[i];

      if (elevLossFromPeak > 18 || (distFromPeak > 250 && segmentGrade < 1.0)) {
        // Encerra no pico anterior
        if (peakIndex > climbStartIndex) {
          rawClimbs.push({ startIndex: climbStartIndex, endIndex: peakIndex });
        }
        inClimb = false;
      }
    }
  }

  // Se terminou o trajeto dentro de uma subida
  if (inClimb && peakIndex > climbStartIndex) {
    rawClimbs.push({ startIndex: climbStartIndex, endIndex: peakIndex });
  }

  // Filtrar e construir os segmentos finais
  const climbs: ClimbSegment[] = [];
  let climbIndexCounter = 1;

  for (const raw of rawClimbs) {
    const sIdx = raw.startIndex;
    const eIdx = raw.endIndex;

    const startDistM = distancesM[sIdx];
    const endDistM = distancesM[eIdx];
    const distanceM = endDistM - startDistM;

    const startElevM = smoothedElev[sIdx];
    const topElevM = smoothedElev[eIdx];
    const elevationGainM = Math.max(0, topElevM - startElevM);

    if (distanceM < 200 || elevationGainM < 15) {
      continue; // Ignora aclives insignificantes
    }

    const avgGradePct = (elevationGainM / distanceM) * 100;
    if (avgGradePct < 2.5) {
      continue; // Requer pelo menos 2.5% de inclinação média
    }

    // Calcular inclinação máxima em janelas de 50m
    let maxGradePct = avgGradePct;
    for (let j = sIdx + 1; j <= eIdx; j++) {
      const d = distancesM[j] - distancesM[j - 1];
      if (d > 5) {
        const g = ((smoothedElev[j] - smoothedElev[j - 1]) / d) * 100;
        if (g > maxGradePct) maxGradePct = g;
      }
    }

    const { category, climbScore } = classifyClimb(distanceM, avgGradePct, elevationGainM);

    // Construir perfil normalizado de pontos para desenhar minigráfico
    const profilePoints: Array<{ distM: number; elevM: number; gradePct: number }> = [];
    for (let j = sIdx; j <= eIdx; j++) {
      const relDistM = distancesM[j] - startDistM;
      const elevM = smoothedElev[j];
      const prevElev = j > sIdx ? smoothedElev[j - 1] : elevM;
      const prevDist = j > sIdx ? distancesM[j] - distancesM[j - 1] : 1;
      const localGrade = prevDist > 0 ? ((elevM - prevElev) / prevDist) * 100 : avgGradePct;

      profilePoints.push({
        distM: Math.round(relDistM),
        elevM: Math.round(elevM * 10) / 10,
        gradePct: Math.round(localGrade * 10) / 10,
      });
    }

    climbs.push({
      id: `climb-${climbIndexCounter}`,
      climbIndex: climbIndexCounter,
      name: `Subida ${climbIndexCounter}`,
      category,
      climbScore,
      startIndex: sIdx,
      endIndex: eIdx,
      startDistM: Math.round(startDistM),
      endDistM: Math.round(endDistM),
      distanceM: Math.round(distanceM),
      startElevM: Math.round(startElevM),
      topElevM: Math.round(topElevM),
      elevationGainM: Math.round(elevationGainM),
      avgGradePct: Math.round(avgGradePct * 10) / 10,
      maxGradePct: Math.round(maxGradePct * 10) / 10,
      profilePoints,
    });

    climbIndexCounter++;
  }

  return climbs;
}

/**
 * Calcula o estado em tempo real do ciclista em relação às subidas da rota.
 */
export function getClimbProgress(
  climbs: ClimbSegment[],
  currentDistM: number,
  currentLiveGradePct?: number | null
): ClimbProgressState {
  const totalClimbsCount = climbs.length;

  if (totalClimbsCount === 0) {
    return {
      isActiveClimb: false,
      currentClimb: null,
      currentClimbNumber: null,
      totalClimbsCount: 0,
      climbProgressPct: 0,
      distanceRemainingM: 0,
      elevationRemainingM: 0,
      currentGradePct: currentLiveGradePct ?? 0,
      avgGradeRemainingPct: 0,
      nextClimb: null,
      distanceToNextClimbM: null,
      isApproachingClimb: false,
    };
  }

  // 1. Verificar se o atleta está dentro de uma subida ativa
  const activeClimb = climbs.find(
    (c) => currentDistM >= c.startDistM && currentDistM <= c.endDistM
  );

  if (activeClimb) {
    const distDoneInClimb = Math.max(0, currentDistM - activeClimb.startDistM);
    const distanceRemainingM = Math.max(0, activeClimb.endDistM - currentDistM);
    const climbProgressPct = Math.min(
      100,
      Math.max(0, (distDoneInClimb / activeClimb.distanceM) * 100)
    );

    // Calcular elevação restante proporcional
    const elevDone = (activeClimb.elevationGainM * climbProgressPct) / 100;
    const elevationRemainingM = Math.max(0, activeClimb.elevationGainM - elevDone);
    const avgGradeRemainingPct =
      distanceRemainingM > 10 ? (elevationRemainingM / distanceRemainingM) * 100 : 0;

    return {
      isActiveClimb: true,
      currentClimb: activeClimb,
      currentClimbNumber: activeClimb.climbIndex,
      totalClimbsCount,
      climbProgressPct: Math.round(climbProgressPct),
      distanceRemainingM: Math.round(distanceRemainingM),
      elevationRemainingM: Math.round(elevationRemainingM),
      currentGradePct: currentLiveGradePct ?? activeClimb.avgGradePct,
      avgGradeRemainingPct: Math.round(avgGradeRemainingPct * 10) / 10,
      nextClimb: null,
      distanceToNextClimbM: null,
      isApproachingClimb: false,
    };
  }

  // 2. Não está em subida ativa: Encontrar a próxima subida
  const nextClimb = climbs.find((c) => c.startDistM > currentDistM) || null;
  const distanceToNextClimbM = nextClimb ? Math.max(0, nextClimb.startDistM - currentDistM) : null;
  const isApproachingClimb =
    distanceToNextClimbM !== null && distanceToNextClimbM <= 200 && distanceToNextClimbM >= 10;

  return {
    isActiveClimb: false,
    currentClimb: null,
    currentClimbNumber: null,
    totalClimbsCount,
    climbProgressPct: 0,
    distanceRemainingM: 0,
    elevationRemainingM: 0,
    currentGradePct: currentLiveGradePct ?? 0,
    avgGradeRemainingPct: 0,
    nextClimb,
    distanceToNextClimbM: distanceToNextClimbM !== null ? Math.round(distanceToNextClimbM) : null,
    isApproachingClimb,
  };
}

/**
 * Enriquece uma lista de pontos de rota buscando altitudes na API pública Open-Meteo se necessário.
 */
export async function enrichRouteWithElevation(points: RoutePoint[]): Promise<RoutePoint[]> {
  if (!points || points.length === 0) return points;

  // Se mais de 80% dos pontos já têm altitude válida, reutiliza
  const pointsWithElev = points.filter((p) => typeof p.elevation === "number" && !isNaN(p.elevation));
  if (pointsWithElev.length >= points.length * 0.8) {
    return points;
  }

  requireElevationConsent();

  const BATCH_SIZE = 100;
  const enriched: RoutePoint[] = [...points];

  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const chunk = points.slice(i, i + BATCH_SIZE);
    const lats = chunk.map((p) => p.lat.toFixed(6)).join(",");
    const lngs = chunk.map((p) => p.lng.toFixed(6)).join(",");
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`;

    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.elevation)) {
          for (let j = 0; j < chunk.length; j++) {
            if (data.elevation[j] != null) {
              enriched[i + j].elevation = data.elevation[j];
            }
          }
        }
      }
    } catch (e) {
      console.warn("Erro ao buscar altitude Open-Meteo:", e);
    }
  }

  return enriched;
}
