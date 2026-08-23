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
  /** Potência Limiar Funcional (FTP - Functional Threshold Power em Watts) para ciclismo. */
  cyclingFtpWatts?: number;
  /** Configuração do Assistente de Voz (Voice Coach). */
  voiceCoach?: VoiceCoachConfig;
  /** Configuração de Auto-Pause Inteligente. */
  autoPause?: AutoPauseConfig;
  /** Idioma preferido do usuário ("pt" ou "en"). */
  language?: "pt" | "en";
  updatedAt: string;
}

export interface AutoPauseConfig {
  enabled: boolean;
  /** Velocidade mínima em km/h abaixo da qual o treino é auto-pausado (ex: 1.5 para corrida, 0.8 para caminhada). */
  minSpeedKmh: number;
  /** Segundos contínuos de baixa velocidade antes de acionar a pausa (ex: 3). */
  pauseDelaySec: number;
  /** Feedback sonoro/voz informando "Treino pausado automaticamente" / "Treino retomado". */
  audioFeedback: boolean;
}

export type VoiceCoachTriggerType = "distance" | "time";

export interface VoiceCoachConfig {
  enabled: boolean;
  triggerType: VoiceCoachTriggerType;
  /** Intervalo em metros para gatilho por distância (ex: 500, 1000, 2000, 5000) */
  distanceIntervalM: number;
  /** Intervalo em segundos para gatilho por tempo (ex: 60, 120, 180, 300, 600) */
  timeIntervalSec: number;
  /** Falar distância total */
  speakDistance: boolean;
  /** Falar tempo decorrido */
  speakTime: boolean;
  /** Falar ritmo médio */
  speakAvgPace: boolean;
  /** Falar ritmo instantâneo */
  speakCurrentPace: boolean;
  /** Falar frequência cardíaca */
  speakHeartRate: boolean;
  /** Falar zona de frequência cardíaca (Z1-Z5) */
  speakHeartRateZone: boolean;
  /** Falar split do último km completado */
  speakLastSplit: boolean;
  /** Falar velocidade média em km/h (recomendado para ciclismo) */
  speakSpeedKmh?: boolean;
  /** Falar velocidade instantânea em km/h */
  speakCurrentSpeedKmh?: boolean;
  /** Falar cadência de pedalada em RPM */
  speakCadence?: boolean;
  /** Falar potência em Watts */
  speakPowerWatts?: boolean;
  /** Falar ganho de elevação acumulado */
  speakElevationGain?: boolean;
  /** Velocidade da voz (0.7 a 1.5, padrão 1.0) */
  speechRate: number;
  /** Tom da voz (0.8 a 1.2, padrão 1.0) */
  speechPitch: number;
  /** Volume da voz (0.1 a 1.0, padrão 1.0) */
  speechVolume: number;
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

export type VO2MaxCategory =
  | "superior"
  | "excellent"
  | "good"
  | "fair"
  | "poor";

export interface VO2MaxEstimate {
  vo2Max: number;
  category: VO2MaxCategory;
  fitnessAge: number;
  chronologicalAge?: number;
  method: "heart_rate_running" | "hr_ratio" | "vdot_performance" | "estimated";
  confidence: "high" | "medium" | "low";
  sampleCount: number;
  calculatedAt: string;
}

export type RaceDistanceId = "5k" | "10k" | "half_marathon" | "marathon";

export interface RacePrediction {
  id: RaceDistanceId;
  nameKey: string;
  distanceM: number;
  predictedTimeSec: number;
  targetPaceSecKm: number;
  baseActivityId?: string;
  baseDistanceM?: number;
}

// ── Coggan Cycling Power Zones Types (Feature 29 / Etapa 7) ─────────────────

export type PowerZoneId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface PowerZone {
  zone: PowerZoneId;
  nameKey: string;
  descKey: string;
  minPct: number; // ex: 0.55
  maxPct: number; // ex: 0.75 (ou 9.99 para Z7)
  minWatts: number;
  maxWatts: number;
  color: string;
  bgRgba: string;
}

export interface PowerZoneDurationSummary {
  zone: PowerZone;
  durationSec: number;
  percent: number;
}

export interface PowerZoneAnalysis {
  ftpWatts: number;
  avgWatts: number;
  maxWatts: number;
  normalizedPowerWatts?: number;
  intensityFactor?: number; // IF = NP / FTP
  trainingStressScore?: number; // TSS
  variabilityIndex?: number; // VI = NP / avgWatts
  wattsPerKg?: number;
  hasPower: boolean;
  totalTimeSec: number;
  zones: PowerZoneDurationSummary[];
  dominantZone: PowerZoneId | null;
}


export interface TrackPoint {
  lat: number;
  lng: number;
  elevation?: number;
  timestamp?: Date;
  hr?: number;
  /** Potência mecânica em Watts (nativo de sensor ou calculado por física) */
  watts?: number;
  /** Cadência em RPM */
  cadence?: number;
  /** Velocidade instantânea em km/h */
  speedKmh?: number;
  /** Inclinação do terreno (% grade) */
  grade?: number;
}

export interface ParsedActivity {
  name: string;
  sport: Sport;
  startedAt: Date;
  durationSec: number;
  movingTimeSec?: number;
  elapsedTimeSec?: number;
  distanceM: number;
  avgPaceSecKm?: number;
  maxPaceSecKm?: number;
  avgSpeedKmh?: number;
  maxSpeedKmh?: number;
  avgWatts?: number;
  maxWatts?: number;
  normalizedPowerWatts?: number;
  vamMh?: number;
  maxGradePercent?: number;
  avgCadenceRpm?: number;
  maxCadenceRpm?: number;
  calories?: number;
  elevationGainM?: number;
  avgHr?: number;
  maxHr?: number;
  workoutId?: string | null;
  structuredWorkoutReport?: StructuredWorkoutReport | null;
  points: TrackPoint[];
}

export interface ActivitySummary {
  id: string;
  name: string;
  sport: Sport;
  startedAt: string;
  durationSec: number;
  movingTimeSec?: number | null;
  elapsedTimeSec?: number | null;
  distanceM: number;
  avgPaceSecKm: number | null;
  avgSpeedKmh?: number | null;
  maxSpeedKmh?: number | null;
  avgWatts?: number | null;
  maxWatts?: number | null;
  normalizedPowerWatts?: number | null;
  vamMh?: number | null;
  maxGradePercent?: number | null;
  avgCadenceRpm?: number | null;
  maxCadenceRpm?: number | null;
  elevationGainM: number | null;
  avgHr: number | null;
  calories: number | null;
  source: string;
  fileName: string | null;
  gearId: string | null;
  routeId?: string | null;
  workoutId?: string | null;
  structuredWorkoutReport?: StructuredWorkoutReport | null;
}

export interface ActivityDetail extends ActivitySummary {
  maxPaceSecKm: number | null;
  maxHr: number | null;
  notes: string | null;
  points: TrackPoint[];
}

export type GearType = "shoes" | "bike";

export type BikeType =
  | "road"
  | "mtb"
  | "gravel"
  | "urban"
  | "ebike"
  | "tt"
  | "other";

export type BikeComponentType =
  | "chain"
  | "front_tire"
  | "rear_tire"
  | "brake_pads"
  | "tubeless_sealant"
  | "cables"
  | "general_service"
  | "custom";

export interface BikeComponentMaintenanceLog {
  id: string;
  replacedAt: string;
  odometerKm: number;
  notes?: string;
}

export interface BikeComponent {
  id: string;
  name: string;
  type: BikeComponentType;
  brandModel?: string;
  /** Hodômetro da bike (em metros) no momento em que a peça foi instalada */
  installedDistanceM: number;
  /** Limite máximo recomendado em metros antes da próxima troca/revisão */
  maxDistanceM: number;
  installedAt: string;
  lastServiceAt?: string;
  notes?: string;
  maintenanceHistory?: BikeComponentMaintenanceLog[];
}

export interface Gear {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  type?: GearType; // "shoes" (default) ou "bike"
  bikeType?: BikeType;
  /** Peso da bike em kg (essencial para cálculo de potência em Watts) */
  weightKg?: number;
  /** Tamanho do aro/pneu (ex: 700x28c, 29x2.25) */
  wheelSize?: string;
  /** Componentes mecânicos rastreados */
  components?: BikeComponent[];
  initialDistanceM: number;
  maxDistanceM?: number;
  status: "active" | "retired";
  isDefault: boolean; // default para corrida
  isDefaultCycling?: boolean; // default para ciclismo
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

export type ClimbCategory = "HC" | "Cat 1" | "Cat 2" | "Cat 3" | "Cat 4" | "Uncategorized";

export interface ClimbSegment {
  id: string;
  climbIndex: number;
  name: string;
  category: ClimbCategory;
  climbScore: number;
  startIndex: number;
  endIndex: number;
  startDistM: number;
  endDistM: number;
  distanceM: number;
  startElevM: number;
  topElevM: number;
  elevationGainM: number;
  avgGradePct: number;
  maxGradePct: number;
  profilePoints: Array<{ distM: number; elevM: number; gradePct: number }>;
}

export interface ClimbProgressState {
  isActiveClimb: boolean;
  currentClimb: ClimbSegment | null;
  currentClimbNumber: number | null; // 1-indexed (ex: 2 de 4)
  totalClimbsCount: number;
  climbProgressPct: number; // 0 a 100
  distanceRemainingM: number;
  elevationRemainingM: number;
  currentGradePct: number;
  avgGradeRemainingPct: number;
  nextClimb: ClimbSegment | null;
  distanceToNextClimbM: number | null;
  isApproachingClimb: boolean; // <= 200m do início
}

export interface SavedRoute {
  id: string;
  name: string;
  points: RoutePoint[];
  distanceM: number;
  elevationGainM?: number;
  climbs?: ClimbSegment[];
  source: "drawn" | "imported";
  createdAt: string;
  sport?: Sport;
  color?: string;
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

// ── Structured Workout / Interval Builder Types (Feature 23) ───────────────

export type WorkoutStepType = "warmup" | "work" | "recovery" | "cooldown";
export type WorkoutTargetType = "distance" | "time" | "open";

export interface WorkoutPaceTarget {
  minPaceSecKm?: number; // ex: 270 (4:30/km)
  maxPaceSecKm?: number; // ex: 300 (5:00/km)
}

export interface WorkoutPowerTarget {
  minWatts?: number;
  maxWatts?: number;
  targetWatts?: number;
  powerZoneTarget?: PowerZoneId;
  percentFtpTarget?: { minPct?: number; maxPct?: number }; // ex: { minPct: 88, maxPct: 94 }
}

export interface WorkoutCadenceTarget {
  minCadenceRpm?: number; // ex: 85
  maxCadenceRpm?: number; // ex: 95
  targetCadenceRpm?: number;
}

export interface WorkoutStep {
  id: string;
  type: WorkoutStepType;
  name?: string;
  targetType: WorkoutTargetType;
  targetValue: number; // metros para distance (ex: 400), segundos para time (ex: 90), 0 para open
  paceTarget?: WorkoutPaceTarget;
  powerTarget?: WorkoutPowerTarget;
  cadenceTarget?: WorkoutCadenceTarget;
  hrZoneTarget?: HRZoneId;
  powerZoneTarget?: PowerZoneId;
  percentFtpTarget?: { minPct?: number; maxPct?: number };
  notes?: string;
}

export interface WorkoutRepeatBlock {
  id: string;
  type: "repeat";
  repeats: number; // ex: 6 vezes
  steps: WorkoutStep[];
}

export type WorkoutItem = WorkoutStep | WorkoutRepeatBlock;

export interface StructuredWorkout {
  id: string;
  name: string;
  description?: string;
  sport: Sport;
  items: WorkoutItem[];
  isPreset?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FlatWorkoutStep {
  stepId: string;
  blockId?: string;
  stepIndex: number;
  totalSteps: number;
  repeatIndex?: number;
  totalRepeats?: number;
  step: WorkoutStep;
}

export interface ExecutedStepReport {
  stepIndex: number;
  name: string;
  type: WorkoutStepType;
  targetType: WorkoutTargetType;
  targetValue: number;
  paceTarget?: WorkoutPaceTarget;
  powerTarget?: WorkoutPowerTarget;
  cadenceTarget?: WorkoutCadenceTarget;
  hrZoneTarget?: HRZoneId;
  powerZoneTarget?: PowerZoneId;
  percentFtpTarget?: { minPct?: number; maxPct?: number };
  repeatIndex?: number;
  totalRepeats?: number;
  durationSec: number;
  distanceM: number;
  avgPaceSecKm: number | null;
  avgWatts?: number | null;
  avgCadenceRpm?: number | null;
  avgHr: number | null;
  targetMet: boolean;
}

export interface StructuredWorkoutReport {
  workoutId: string;
  workoutName: string;
  completedAt: string;
  totalSteps: number;
  completedSteps: number;
  complianceRatePercent: number; // ex: 85%
  steps: ExecutedStepReport[];
}

export interface ManualLap {
  lapNumber: number;
  startedAtSec: number;
  durationSec: number;
  distanceM: number;
  avgSpeedKmh: number;
  avgWatts?: number;
  avgHr?: number;
  elevationGainM?: number;
}

export type BikeHudTheme = "sun" | "dark" | "neo";
export type BikeHudOrientation = "auto" | "portrait" | "landscape";
export type BikeHudLayout = "split_map" | "data_only";

export interface BikeHudConfig {
  theme: BikeHudTheme;
  orientation: BikeHudOrientation;
  layout: BikeHudLayout;
  showMapInLandscape: boolean;
  touchLockEnabled: boolean;
}


