import { makeStoredActivity, makeStructuredWorkoutReport } from "./activityFactory";
import type { StoredActivity } from "@/lib/storage";

export function generateSyntheticActivities(count: number): StoredActivity[] {
  const list: StoredActivity[] = [];
  const baseDate = new Date("2026-08-24T12:00:00.000Z").getTime();

  for (let i = 0; i < count; i++) {
    const startedAt = new Date(baseDate - i * 86400000).toISOString();
    const isCycling = i % 3 === 0;
    list.push(
      makeStoredActivity({
        id: `synth-act-${i.toString().padStart(4, "0")}`,
        name: `${isCycling ? "Pedal" : "Corrida"} Sintético #${i + 1}`,
        sport: isCycling ? "cycling" : "running",
        startedAt,
        distanceM: 5000 + (i % 20) * 1000,
        durationSec: 1800 + (i % 20) * 300,
        avgPaceSecKm: isCycling ? null : 330 + (i % 30) * 5,
        avgSpeedKmh: isCycling ? 25.5 + (i % 10) : 10.5,
        avgWatts: isCycling ? 180 + (i % 50) : null,
        workoutId: i % 5 === 0 ? `workout-${i}` : null,
        structuredWorkoutReport:
          i % 5 === 0
            ? makeStructuredWorkoutReport({ workoutId: `workout-${i}` })
            : null,
      })
    );
  }

  return list;
}
