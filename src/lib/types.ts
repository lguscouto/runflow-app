export type Sport = "running" | "walking" | "cycling" | "other";

export interface UserProfile {
  age?: number;
  heightCm?: number;
  weightKg?: number;
  bodyFatPercent?: number;
  /** Meta de distância por semana (km). */
  weeklyDistanceKm?: number;
  /** Meta de quantidade de treinos por semana. */
  weeklyWorkouts?: number;
  updatedAt: string;
}

export interface TrackPoint {
  lat: number;
  lng: number;
  elevation?: number;
  timestamp?: Date;
  hr?: number;
}

export interface ParsedActivity {
  name: string;
  sport: Sport;
  startedAt: Date;
  durationSec: number;
  distanceM: number;
  avgPaceSecKm?: number;
  maxPaceSecKm?: number;
  calories?: number;
  elevationGainM?: number;
  avgHr?: number;
  maxHr?: number;
  points: TrackPoint[];
}

export interface ActivitySummary {
  id: string;
  name: string;
  sport: Sport;
  startedAt: string;
  durationSec: number;
  distanceM: number;
  avgPaceSecKm: number | null;
  elevationGainM: number | null;
  avgHr: number | null;
  calories: number | null;
  source: string;
  fileName: string | null;
}

export interface ActivityDetail extends ActivitySummary {
  maxPaceSecKm: number | null;
  maxHr: number | null;
  notes: string | null;
  points: TrackPoint[];
}

export interface DashboardStats {
  totalActivities: number;
  totalDistanceM: number;
  totalDurationSec: number;
  thisWeekDistanceM: number;
  thisWeekActivities: number;
}
