import { getStoredActivity, putActivity } from "./storage";
import { elevationGainFromPoints } from "./geo";

export async function enrichActivityElevation(activityId: string): Promise<number> {
  const activity = await getStoredActivity(activityId);
  if (!activity) {
    throw new Error("Activity not found");
  }

  const points = activity.points;
  if (!points || points.length === 0) return 0;

  const BATCH_SIZE = 150;
  const fetchPromises: Promise<number[]>[] = [];

  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);
    const lats = batch.map((p) => p.lat.toFixed(6)).join(",");
    const lngs = batch.map((p) => p.lng.toFixed(6)).join(",");
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`;

    fetchPromises.push(
      fetch(url).then(async (res) => {
        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }
        const data = await res.json();
        if (!data || !Array.isArray(data.elevation)) {
          throw new Error("Invalid response format");
        }
        return data.elevation as number[];
      })
    );
  }

  const results = await Promise.all(fetchPromises);
  const elevations = results.flat();

  // Associar as altitudes aos pontos correspondentes
  for (let i = 0; i < points.length; i++) {
    if (elevations[i] !== undefined && elevations[i] !== null) {
      points[i].elevation = elevations[i];
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
  
  // Atualizar a atividade com as novas altitudes e ganho recalculado
  activity.elevationGainM = Math.round(newElevationGainM);
  activity.points = points;

  await putActivity(activity);

  return activity.elevationGainM;
}
