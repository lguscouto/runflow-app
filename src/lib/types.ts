export type Sport = "running" | "walking" | "cycling" | "other";

export interface UserProfile {
  name?: string;
  onboarded?: boolean;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  bodyFatPercent?: number;
  /** Meta de distância por semana (km). */
  weeklyDistanceKm?: number;
  /** Meta de quantidade de treinos por semana. */
  weeklyWorkouts?: number;
  /** Distância mínima em km para considerar recorde de ritmo (ex: 5). */
  prMinPaceDistanceKm?: number;
  /** Idioma preferido do usuário ("pt" ou "en"). */
  language?: "pt" | "en";
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
  gearId: string | null;
  routeId?: string | null;
}

export interface ActivityDetail extends ActivitySummary {
  maxPaceSecKm: number | null;
  maxHr: number | null;
  notes: string | null;
  points: TrackPoint[];
}

export interface Gear {
  id: string;
  name: string;
  brand?: string;
  initialDistanceM: number;
  maxDistanceM?: number;
  status: "active" | "retired";
  isDefault: boolean;
  notes?: string;
  createdAt: string;
}

export interface DashboardStats {
  totalActivities: number;
  totalDistanceM: number;
  totalDurationSec: number;
  thisWeekDistanceM: number;
  thisWeekActivities: number;
}

export interface RoutePoint {
  lat: number;
  lng: number;
  elevation?: number;
}

export interface SavedRoute {
  id: string;
  name: string;
  points: RoutePoint[];
  distanceM: number;
  source: "drawn" | "imported";
  createdAt: string;
  sport?: Sport;
}

export interface RouteConfig {
  routeId: string;
  offRouteToleranceM: number;
  audioAlerts: boolean;
  audioFreq: "1km" | "2min" | "5min";
}

export interface OffRouteState {
  isOffRoute: boolean;
  distanceFromRouteM: number;
  nearestPoint: RoutePoint | null;
  estimatedDistanceM: number;
  totalRouteDistanceM: number;
}

export interface GhostConfig {
  mode: "disabled" | "pace" | "activity";
  targetPaceSecKm?: number; // Ritmo alvo em segundos por quilômetro (ex: 300 para 5:00/km)
  activityId?: string | null; // ID da atividade anterior
  routeId?: string; // ID da rota para navegação
  audioAlerts: boolean;
  audioFreq: "1km" | "2min" | "5min";
}

export interface GhostStats {
  distanceM: number;
  diffM: number;
  status: "ahead" | "behind" | "tied";
}

