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
  /** Frequência cardíaca máxima manual (bpm). */
  maxHr?: number;
  /** Frequência cardíaca de repouso (bpm). */
  restingHr?: number;
  /** Idioma preferido do usuário ("pt" ou "en"). */
  language?: "pt" | "en";
  updatedAt: string;
}

export type HRZoneId = 1 | 2 | 3 | 4 | 5;

export interface HeartRateZone {
  zone: HRZoneId;
  nameKey: string;
  descKey: string;
  minBpm: number;
  maxBpm: number;
  minPct: number;
  maxPct: number;
  color: string;
  bgRgba: string;
}

export interface ZoneDurationSummary {
  zone: HeartRateZone;
  durationSec: number;
  percent: number;
}

export type TrainingEffectCategory =
  | "recovery"
  | "aerobic_base"
  | "tempo"
  | "threshold"
  | "anaerobic_vo2";

export interface HeartRateZoneAnalysis {
  maxHr: number;
  restingHr?: number;
  avgHr: number;
  peakHr: number;
  hasHeartRate: boolean;
  totalTimeSec: number;
  zones: ZoneDurationSummary[];
  dominantZone: HRZoneId | null;
  trimpScore: number;
  trainingEffect: TrainingEffectCategory;
  trainingLoadLabel: "light" | "moderate" | "optimal" | "extreme";
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

// ── Multi-Device Sync Types (Feature 15) ───────────────────────────────────

export interface SyncManifest {
  version: number;
  deviceId: string;
  generatedAt: string;
  activities: Array<{ id: string; startedAt: string; durationSec: number }>;
  gear: Array<{ id: string; createdAt: string }>;
  routes: Array<{ id: string; createdAt: string }>;
  profileUpdatedAt?: string;
}

export interface SyncPayload {
  profile?: UserProfile | null;
  gear?: Gear[];
  activities?: any[]; // StoredActivity[]
  routes?: SavedRoute[];
}

export interface SyncReport {
  activitiesReceived: number;
  activitiesSent: number;
  gearReceived: number;
  gearSent: number;
  routesReceived: number;
  routesSent: number;
  profileUpdated: boolean;
  timestamp: string;
}

export interface WebDavConfig {
  serverUrl: string;
  username: string;
  password?: string;
  remotePath: string;
  lastSyncedAt?: string;
}

