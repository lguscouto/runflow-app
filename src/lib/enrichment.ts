import { getStoredActivity, putActivity } from "./storage";
import { parseFit } from "./parsers/fit";
import type { TrackPoint, ParsedActivity } from "./types";
import { elevationGainFromPoints } from "./geo";
import { requireElevationConsent } from "./external-privacy";

/**
 * Extrai a lógica de merge de HR dos pontos FIT para os pontos GPX,
 * reutilizando o algoritmo de sincronia temporal do import-file.ts
 */
function mergeHeartRateIntoPoints(
  gpxPoints: TrackPoint[],
  fitPoints: TrackPoint[]
): TrackPoint[] {
  const fitWithHr = fitPoints.filter(
    (p) => p.hr !== undefined && p.timestamp instanceof Date
  );

  if (fitWithHr.length === 0) {
    return gpxPoints; // sem HR para mesclar
  }

  let fitIdx = 0;
  return gpxPoints.map((gp) => {
    if (!gp.timestamp) return gp;

    const gt = gp.timestamp.getTime();

    // Encontra o ponto FIT mais próximo no tempo
    let bestDiff = Math.abs(
      gt - (fitWithHr[fitIdx].timestamp as Date).getTime()
    );
    while (fitIdx + 1 < fitWithHr.length) {
      const nextTime = (fitWithHr[fitIdx + 1].timestamp as Date).getTime();
      const nextDiff = Math.abs(gt - nextTime);
      if (nextDiff < bestDiff) {
        bestDiff = nextDiff;
        fitIdx++;
      } else {
        break;
      }
    }

    const bestFit = fitWithHr[fitIdx];
    if (bestDiff <= 15000) {
      // tolerância de 15s
      return { ...gp, hr: bestFit.hr };
    }
    return gp;
  });
}

/**
 * Dados de merge para resultado da operação
 */
export interface MergeResult {
  activityId: string;
  hrPointsAdded: number;
  hasHrData: boolean;
  avgHr: number | undefined;
  maxHr: number | undefined;
}

/**
 * Faz o merge de um arquivo FIT em uma atividade existente,
 * enriquecendo os pontos GPS com dados de frequência cardíaca.
 *
 * 1. Carrega a atividade salva no IndexedDB
 * 2. Faz o parse do arquivo FIT
 * 3. Valida proximidade temporal (≤ 15 min)
 * 4. Mescla HR nos pontos GPS baseado em timestamp
 * 5. Recalcula avgHr, maxHr, calorias
 * 6. Salva a atividade atualizada
 */
export async function mergeFitHeartRateIntoActivity(
  activityId: string,
  fitFile: File
): Promise<MergeResult> {
  const activity = await getStoredActivity(activityId);
  if (!activity) {
    throw new Error("Atividade não encontrada");
  }

  const points = activity.points;
  if (!points || points.length === 0) {
    throw new Error("Atividade sem pontos GPS");
  }

  const buffer = await fitFile.arrayBuffer();
  const parsedFit: ParsedActivity = await parseFit(buffer, fitFile.name);

  // Validar proximidade temporal (±15 minutos)
  const activityStart = new Date(activity.startedAt).getTime();
  const fitStart = parsedFit.startedAt.getTime();
  const timeDiffMs = Math.abs(activityStart - fitStart);
  if (timeDiffMs > 15 * 60 * 1000) {
    throw new Error(
      `A atividade e o arquivo FIT têm mais de 15 minutos de diferença (${Math.round(
        timeDiffMs / 60000
      )} min). Não é possível mesclar.`
    );
  }

  // Converter timestamps string → Date nos pontos existentes
  const gpxPoints: TrackPoint[] = points.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    elevation: p.elevation,
    timestamp: p.timestamp ? new Date(p.timestamp) : undefined,
    hr: p.hr,
  }));

  // Mesclar HR
  const mergedPoints = mergeHeartRateIntoPoints(gpxPoints, parsedFit.points);

  // Contar quantos pontos receberam HR
  const hrPointsAdded = mergedPoints.filter((p) => p.hr !== undefined).length;
  const hadHrBefore = gpxPoints.some((p) => p.hr !== undefined);
  const hasHrData = hrPointsAdded > 0;

  // Calcular médias de HR
  const hrs =
    hasHrData && !hadHrBefore
      ? mergedPoints
          .map((p) => p.hr)
          .filter((h): h is number => h != null)
      : [];

  const avgHr = hrs.length > 0 ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : undefined;
  const maxHr = hrs.length > 0 ? Math.max(...hrs) : undefined;

  // Converter de volta para o formato serializável do storage
  const serializedPoints = mergedPoints.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    elevation: p.elevation,
    timestamp: p.timestamp?.toISOString(),
    hr: p.hr,
  }));

  // Usar HR do FIT se disponível (apenas se antes não tinha HR)
  const updatedActivity = {
    ...activity,
    points: serializedPoints,
    avgHr: !hadHrBefore ? (avgHr ?? activity.avgHr) : activity.avgHr,
    maxHr: !hadHrBefore ? (maxHr ?? activity.maxHr) : activity.maxHr,
    // Preferir calorias do FIT se vieram do sensor
    calories: parsedFit.calories ?? activity.calories,
  };

  await putActivity(updatedActivity);

  return {
    activityId,
    hrPointsAdded,
    hasHrData,
    avgHr: !hadHrBefore ? avgHr : activity.avgHr ?? undefined,
    maxHr: !hadHrBefore ? maxHr : activity.maxHr ?? undefined,
  };
}

/**
 * Versão melhorada do enrichActivityElevation com retry e tratamento de erros.
 * Mantém compatibilidade com a função existente em elevation.ts,
 * mas adiciona retry exponencial e rate-limit handling.
 */
export async function enrichActivityElevationWithRetry(
  activityId: string,
  onProgress?: (current: number, total: number) => void
): Promise<number> {
  const activity = await getStoredActivity(activityId);
  if (!activity) {
    throw new Error("Atividade não encontrada");
  }

  const points = activity.points;
  if (!points || points.length === 0) return 0;
  requireElevationConsent();

  const BATCH_SIZE = 150;
  const results: number[] = [];
  let errors = 0;

  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);
    const lats = batch.map((p) => p.lat.toFixed(6)).join(",");
    const lngs = batch.map((p) => p.lng.toFixed(6)).join(",");
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`;

    let success = false;
    let attempts = 0;
    const maxRetries = 3;

    while (!success && attempts < maxRetries) {
      attempts++;
      try {
        const res = await fetch(url);
        if (res.status === 429) {
          // Rate limit — esperar e tentar de novo
          const waitMs = Math.min(1000 * attempts, 5000);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }
        const data = await res.json();
        if (!data || !Array.isArray(data.elevation)) {
          throw new Error("Invalid response format");
        }
        results.push(...(data.elevation as number[]));
        success = true;
      } catch (err) {
        if (attempts >= maxRetries) {
          errors++;
          console.warn(
            `Falha ao buscar elevação para lote ${i / BATCH_SIZE + 1} após ${maxRetries} tentativas:`,
            err
          );
          // Preencher com undefined para manter o índice
          results.push(...Array(batch.length).fill(undefined));
          success = true; // Sair do loop, não travar todo o processo
        } else {
          const waitMs = Math.min(1000 * attempts, 5000);
          await new Promise((r) => setTimeout(r, waitMs));
        }
      }
    }

    if (onProgress) {
      onProgress(Math.min(i + BATCH_SIZE, points.length), points.length);
    }
  }

  // Associar altitudes aos pontos
  for (let i = 0; i < points.length; i++) {
    if (results[i] !== undefined && results[i] !== null) {
      points[i].elevation = results[i];
    }
  }

  // Recalcular elevação total
  const trackPoints = points.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    elevation: p.elevation,
    timestamp: p.timestamp ? new Date(p.timestamp) : undefined,
    hr: p.hr,
  }));
  const newElevationGainM = elevationGainFromPoints(trackPoints);

  activity.elevationGainM = Math.round(newElevationGainM);
  activity.points = points;

  await putActivity(activity);

  if (errors > 0) {
    console.warn(
      `Correção de elevação concluída com ${errors} lote(s) com falha (de ${Math.ceil(points.length / BATCH_SIZE)})`
    );
  }

  return activity.elevationGainM;
}