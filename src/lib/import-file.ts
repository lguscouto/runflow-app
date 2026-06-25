import { parseGpx } from "./parsers/gpx";
import { parseFit } from "./parsers/fit";
import { importRouteGpx as parseRouteGpx } from "./parsers/route-gpx";
import { saveActivity } from "./activities";
import { putRoute } from "./storage";
import type { TrackPoint, SavedRoute } from "./types";

export async function importWorkoutFile(file: File): Promise<string> {
  const fileName = file.name;
  const ext = fileName.split(".").pop()?.toLowerCase();

  if (ext === "gpx" || fileName.toLowerCase().endsWith(".gpx")) {
    const text = await file.text();
    const parsed = parseGpx(text, fileName);
    return saveActivity(parsed, "gpx", fileName);
  }

  if (ext === "fit" || fileName.toLowerCase().endsWith(".fit")) {
    const buffer = await file.arrayBuffer();
    const parsed = await parseFit(buffer, fileName);
    return saveActivity(parsed, "fit", fileName);
  }

  throw new Error("Formato não suportado. Use .gpx ou .fit");
}

export interface ImportResult {
  lastId: string | null;
  count: number;
  merged: boolean;
}

export async function importWorkoutFiles(files: File[]): Promise<ImportResult> {
  const valid = files.filter((f) => /\.(gpx|fit)$/i.test(f.name));
  
  if (valid.length === 2) {
    const fileGpx = valid.find((f) => f.name.toLowerCase().endsWith(".gpx"));
    const fileFit = valid.find((f) => f.name.toLowerCase().endsWith(".fit"));

    if (fileGpx && fileFit) {
      try {
        const textGpx = await fileGpx.text();
        const parsedGpx = parseGpx(textGpx, fileGpx.name);

        const bufferFit = await fileFit.arrayBuffer();
        const parsedFit = await parseFit(bufferFit, fileFit.name);

        // Validar proximidade temporal (limite de 15 minutos)
        const timeDiffMs = Math.abs(parsedGpx.startedAt.getTime() - parsedFit.startedAt.getTime());
        if (timeDiffMs <= 15 * 60 * 1000) {
          // Filtrar pontos do FIT com frequência cardíaca registrada
          const fitPointsWithHr = parsedFit.points.filter(
            (p) => p.hr !== undefined && p.timestamp instanceof Date
          );

          let mergedPoints = parsedGpx.points;

          if (fitPointsWithHr.length > 0) {
            let fitIdx = 0;
            mergedPoints = parsedGpx.points.map((gp) => {
              if (!gp.timestamp) return gp;
              const gt = gp.timestamp.getTime();

              // Encontra o ponto no FIT mais próximo
              let bestDiff = Math.abs(gt - (fitPointsWithHr[fitIdx].timestamp as Date).getTime());
              while (fitIdx + 1 < fitPointsWithHr.length) {
                const nextTime = (fitPointsWithHr[fitIdx + 1].timestamp as Date).getTime();
                const nextDiff = Math.abs(gt - nextTime);
                if (nextDiff < bestDiff) {
                  bestDiff = nextDiff;
                  fitIdx++;
                } else {
                  break;
                }
              }

              const bestFit = fitPointsWithHr[fitIdx];
              // Tolerância de sincronia de 15 segundos
              if (bestDiff <= 15000) {
                return {
                  ...gp,
                  hr: bestFit.hr,
                };
              }
              return gp;
            });
          }

          // Montar o treino mesclado
          const mergedActivity = {
            name: parsedGpx.name || parsedFit.name || "Treino mesclado",
            sport: parsedFit.sport || parsedGpx.sport || "running",
            startedAt: parsedGpx.startedAt,
            durationSec: parsedGpx.durationSec || parsedFit.durationSec,
            distanceM: parsedGpx.distanceM || parsedFit.distanceM,
            avgPaceSecKm: parsedGpx.avgPaceSecKm || parsedFit.avgPaceSecKm,
            maxPaceSecKm: parsedGpx.maxPaceSecKm || parsedFit.maxPaceSecKm,
            elevationGainM: parsedFit.elevationGainM || parsedGpx.elevationGainM || 0,
            avgHr: parsedFit.avgHr ?? parsedGpx.avgHr,
            maxHr: parsedFit.maxHr ?? parsedGpx.maxHr,
            calories: parsedFit.calories ?? parsedGpx.calories,
            points: mergedPoints,
          };

          const newId = await saveActivity(
            mergedActivity,
            "merged",
            `${fileGpx.name} + ${fileFit.name}`
          );

          return {
            lastId: newId,
            count: 1,
            merged: true,
          };
        }
      } catch (err) {
        console.error("Falha ao tentar mesclar arquivos, importando individualmente:", err);
      }
    }
  }

  // Fallback: importar todos individualmente
  let lastId: string | null = null;
  let importedCount = 0;

  for (const file of valid) {
    lastId = await importWorkoutFile(file);
    importedCount++;
  }

  return {
    lastId,
    count: importedCount,
    merged: false,
  };
}

export async function importRouteGpx(file: File): Promise<SavedRoute> {
  const text = await file.text();
  const route = parseRouteGpx(text, file.name);
  await putRoute(route);
  return route;
}
