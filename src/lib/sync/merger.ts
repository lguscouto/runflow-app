import {
  getStore,
  PROFILE_KEY,
  DASHBOARD_STATS_KEY,
  getAllStoredActivities,
  getAllStoredGear,
  getAllStoredRoutes,
  putActivity,
  putGear,
  putRoute,
  toActivitySummary,
  type StoredActivity,
  type StoredActivityTrack,
} from "../storage";
import {
  applyDashboardStatsDelta,
  createDashboardStatsAggregate,
} from "../dashboard-stats";
import { getUserProfile, saveUserProfileSnapshot } from "../profile";
import type {
  SyncManifest,
  SyncPayload,
  SyncReport,
  UserProfile,
  Gear,
  SavedRoute,
} from "../types";
import { isSupportedLanguage } from "../types";

/**
 * Obtém ou gera um ID único para este dispositivo local no localStorage.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "server-instance";
  const KEY = "runflow_device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    const random = new Uint8Array(8);
    if (globalThis.crypto?.getRandomValues) {
      globalThis.crypto.getRandomValues(random);
      id = `dev_${Array.from(random, (value) => value.toString(16).padStart(2, "0")).join("")}`;
    } else {
      id = `dev_${Date.now().toString(36)}`;
    }
    localStorage.setItem(KEY, id);
  }
  return id;
}

/**
 * Gera um manifesto leve do estado atual do banco de dados local.
 */
export async function generateSyncManifest(): Promise<SyncManifest> {
  const [profile, gear, activities, routes] = await Promise.all([
    getUserProfile(),
    getAllStoredGear(),
    getAllStoredActivities(),
    getAllStoredRoutes(),
  ]);

  return {
    version: 1,
    deviceId: getOrCreateDeviceId(),
    generatedAt: new Date().toISOString(),
    activities: activities.map((a) => ({
      id: a.id,
      startedAt: a.startedAt,
      durationSec: a.durationSec,
    })),
    gear: gear.map((g) => ({
      id: g.id,
      createdAt: g.createdAt,
    })),
    routes: routes.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
    })),
    profileUpdatedAt: profile?.updatedAt,
  };
}

/**
 * Prepara um payload diferencial contendo apenas os dados que o par remoto não possui.
 */
export async function getDeltaPayloadForRemote(
  remoteManifest: SyncManifest
): Promise<SyncPayload> {
  assertValidSyncManifest(remoteManifest);
  const [profile, gear, activities, routes] = await Promise.all([
    getUserProfile(),
    getAllStoredGear(),
    getAllStoredActivities(),
    getAllStoredRoutes(),
  ]);

  const remoteActivityIds = new Set(remoteManifest.activities.map((a) => a.id));
  const remoteGearIds = new Set(remoteManifest.gear.map((g) => g.id));
  const remoteRouteIds = new Set(remoteManifest.routes.map((r) => r.id));

  const missingActivities = activities.filter((a) => !remoteActivityIds.has(a.id));
  const missingGear = gear.filter((g) => !remoteGearIds.has(g.id));
  const missingRoutes = routes.filter((r) => !remoteRouteIds.has(r.id));

  // Envia o perfil se o local for mais novo que o remoto
  let profileToSend: UserProfile | null = null;
  if (profile) {
    if (
      !remoteManifest.profileUpdatedAt ||
      new Date(profile.updatedAt).getTime() >
        new Date(remoteManifest.profileUpdatedAt).getTime()
    ) {
      profileToSend = profile;
    }
  }

  return {
    profile: profileToSend,
    gear: missingGear,
    activities: missingActivities,
    routes: missingRoutes,
  };
}

const MAX_SYNC_PAYLOAD_BYTES = 10 * 1024 * 1024;
const MAX_ACTIVITIES = 1_000;
const MAX_GEAR = 200;
const MAX_ROUTES = 200;
const MAX_ACTIVITY_POINTS = 100_000;
const MAX_ROUTE_POINTS = 50_000;
const MAX_ACTIVITY_SEGMENTS = 1_000;
const MAX_SYNC_MANIFEST_BYTES = 256 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}

function isFiniteInRange(value: unknown, min: number, max: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function isValidCoordinatePoint(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (
    typeof value.lat !== "number" ||
    !Number.isFinite(value.lat) ||
    value.lat < -90 ||
    value.lat > 90 ||
    typeof value.lng !== "number" ||
    !Number.isFinite(value.lng) ||
    value.lng < -180 ||
    value.lng > 180
  ) return false;
  if (value.elevation !== undefined && !isFiniteInRange(value.elevation, -1_000, 10_000)) return false;
  if (value.timestamp !== undefined && !isValidDateString(value.timestamp)) return false;
  if (value.hr !== undefined && !isFiniteInRange(value.hr, 20, 260)) return false;
  if (value.watts !== undefined && !isFiniteInRange(value.watts, 0, 5_000)) return false;
  if (value.cadence !== undefined && !isFiniteInRange(value.cadence, 0, 300)) return false;
  if (value.speedKmh !== undefined && !isFiniteInRange(value.speedKmh, 0, 180)) return false;
  if (value.grade !== undefined && !isFiniteInRange(value.grade, -100, 100)) return false;
  return true;
}

function assertNonDecreasingTimestamps(points: unknown[]): void {
  let previousTimestamp: number | undefined;
  for (const point of points) {
    if (!isRecord(point) || point.timestamp === undefined) continue;
    const currentTimestamp = new Date(String(point.timestamp)).getTime();
    if (previousTimestamp !== undefined && currentTimestamp < previousTimestamp) {
      throw new Error("Payload de sincronização inválido: timestamps fora de ordem.");
    }
    previousTimestamp = currentTimestamp;
  }
}

function assertValidActivityMetricFields(value: Record<string, unknown>): void {
  const ranges: Array<[string, number, number]> = [
    ["movingTimeSec", 0, 86_400 * 7],
    ["elapsedTimeSec", 0, 86_400 * 7],
    ["avgPaceSecKm", 0, 86_400],
    ["maxPaceSecKm", 0, 86_400],
    ["avgSpeedKmh", 0, 180],
    ["maxSpeedKmh", 0, 180],
    ["avgWatts", 0, 5_000],
    ["maxWatts", 0, 5_000],
    ["normalizedPowerWatts", 0, 5_000],
    ["vamMh", 0, 100_000],
    ["maxGradePercent", -100, 100],
    ["avgCadenceRpm", 0, 300],
    ["maxCadenceRpm", 0, 300],
    ["calories", 0, 100_000],
    ["elevationGainM", 0, 100_000],
    ["avgHr", 20, 260],
    ["maxHr", 20, 260],
  ];
  for (const [field, min, max] of ranges) {
    if (value[field] !== undefined && value[field] !== null && !isFiniteInRange(value[field], min, max)) {
      throw new Error(`Payload de sincronização inválido: telemetria ${field}.`);
    }
  }
}

function assertValidActivity(value: unknown): void {
  if (!isRecord(value)) throw new Error("Payload de sincronização inválido: atividade não é um objeto.");
  if (
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    value.id.length > 128 ||
    !["running", "walking", "cycling", "other"].includes(String(value.sport)) ||
    !isValidDateString(value.startedAt) ||
    !isFiniteNonNegative(value.durationSec) ||
    !isFiniteNonNegative(value.distanceM) ||
    !Array.isArray(value.points) ||
    value.points.length > MAX_ACTIVITY_POINTS ||
    !value.points.every(isValidCoordinatePoint)
  ) {
    throw new Error("Payload de sincronização inválido: atividade ou coordenadas inválidas.");
  }
  if (typeof value.name !== "string" || value.name.length > 256 || typeof value.source !== "string" || value.source.length > 128) {
    throw new Error("Payload de sincronização inválido: identificação da atividade.");
  }
  assertValidActivityMetricFields(value);
  assertNonDecreasingTimestamps(value.points);
  if (value.trackSegments !== undefined) {
    if (!Array.isArray(value.trackSegments) || value.trackSegments.length > MAX_ACTIVITY_SEGMENTS) {
      throw new Error("Payload de sincronização inválido: segmentos excedidos.");
    }
    let segmentPoints = 0;
    for (const segment of value.trackSegments) {
      if (!Array.isArray(segment)) throw new Error("Payload de sincronização inválido: segmento inválido.");
      segmentPoints += segment.length;
      if (segmentPoints > MAX_ACTIVITY_POINTS) {
        throw new Error("Payload de sincronização inválido: pontos excedidos.");
      }
      if (!segment.every(isValidCoordinatePoint)) {
        throw new Error("Payload de sincronização inválido: telemetria do segmento.");
      }
      assertNonDecreasingTimestamps(segment);
    }
  }
}

function assertValidGear(value: unknown): void {
  if (!isRecord(value)) throw new Error("Payload de sincronização inválido: equipamento não é um objeto.");
  if (
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    value.id.length > 128 ||
    typeof value.name !== "string" ||
    value.name.length > 256 ||
    !isFiniteNonNegative(value.initialDistanceM) ||
    (value.maxDistanceM !== undefined && !isFiniteNonNegative(value.maxDistanceM)) ||
    (value.status !== "active" && value.status !== "retired") ||
    typeof value.isDefault !== "boolean" ||
    !isValidDateString(value.createdAt)
  ) {
    throw new Error("Payload de sincronização inválido: equipamento inválido.");
  }
}

function assertValidRoute(value: unknown): void {
  if (!isRecord(value)) throw new Error("Payload de sincronização inválido: rota não é um objeto.");
  if (
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    value.id.length > 128 ||
    typeof value.name !== "string" ||
    value.name.length > 256 ||
    !Array.isArray(value.points) ||
    value.points.length > MAX_ROUTE_POINTS ||
    !value.points.every(isValidCoordinatePoint) ||
    !isFiniteNonNegative(value.distanceM) ||
    (value.elevationGainM !== undefined && !isFiniteNonNegative(value.elevationGainM)) ||
    (value.source !== "drawn" && value.source !== "imported") ||
    !isValidDateString(value.createdAt)
  ) {
    throw new Error("Payload de sincronização inválido: rota inválida.");
  }
}

export function assertValidSyncPayload(payload: unknown): asserts payload is SyncPayload {
  let serialized: string;
  try {
    serialized = JSON.stringify(payload);
  } catch {
    throw new Error("Payload de sincronização inválido: JSON não serializável.");
  }
  const byteLength = typeof TextEncoder !== "undefined"
    ? new TextEncoder().encode(serialized).byteLength
    : serialized.length * 2;
  if (byteLength > MAX_SYNC_PAYLOAD_BYTES || !isRecord(payload)) {
    throw new Error("Payload de sincronização inválido: tamanho ou estrutura excedida.");
  }

  if (payload.profile !== undefined && payload.profile !== null) {
    if (
      !isRecord(payload.profile) ||
      !isValidDateString(payload.profile.updatedAt) ||
      (payload.profile.language !== undefined && !isSupportedLanguage(payload.profile.language))
    ) {
      throw new Error("Payload de sincronização inválido: perfil inválido.");
    }
  }
  if (payload.activities !== undefined) {
    if (!Array.isArray(payload.activities) || payload.activities.length > MAX_ACTIVITIES) {
      throw new Error("Payload de sincronização inválido: limite de atividades excedido.");
    }
    payload.activities.forEach(assertValidActivity);
  }
  if (payload.gear !== undefined) {
    if (!Array.isArray(payload.gear) || payload.gear.length > MAX_GEAR) {
      throw new Error("Payload de sincronização inválido: limite de equipamentos excedido.");
    }
    payload.gear.forEach(assertValidGear);
  }
  if (payload.routes !== undefined) {
    if (!Array.isArray(payload.routes) || payload.routes.length > MAX_ROUTES) {
      throw new Error("Payload de sincronização inválido: limite de rotas excedido.");
    }
    payload.routes.forEach(assertValidRoute);
  }
}

export function assertValidSyncManifest(manifest: unknown): asserts manifest is SyncManifest {
  if (!isRecord(manifest)) {
    throw new Error("Manifesto de sincronização inválido.");
  }
  let serializedManifest: string;
  try {
    serializedManifest = JSON.stringify(manifest);
  } catch {
    throw new Error("Manifesto de sincronização inválido: JSON não serializável.");
  }
  const manifestBytes = typeof TextEncoder !== "undefined"
    ? new TextEncoder().encode(serializedManifest).byteLength
    : serializedManifest.length * 2;
  if (manifestBytes > MAX_SYNC_MANIFEST_BYTES) {
    throw new Error("Manifesto de sincronização inválido: tamanho excedido.");
  }
  if (
    manifest.version !== 1 ||
    typeof manifest.deviceId !== "string" ||
    manifest.deviceId.length === 0 ||
    manifest.deviceId.length > 128 ||
    !isValidDateString(manifest.generatedAt) ||
    !Array.isArray(manifest.activities) ||
    manifest.activities.length > MAX_ACTIVITIES ||
    !Array.isArray(manifest.gear) ||
    manifest.gear.length > MAX_GEAR ||
    !Array.isArray(manifest.routes) ||
    manifest.routes.length > MAX_ROUTES
  ) {
    throw new Error("Manifesto de sincronização inválido.");
  }
  for (const activity of manifest.activities) {
    if (
      !isRecord(activity) ||
      typeof activity.id !== "string" ||
      activity.id.length === 0 ||
      activity.id.length > 128 ||
      !isValidDateString(activity.startedAt) ||
      !isFiniteNonNegative(activity.durationSec)
    ) throw new Error("Manifesto de sincronização inválido: atividade.");
  }
  for (const item of [...manifest.gear, ...manifest.routes]) {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      item.id.length === 0 ||
      item.id.length > 128 ||
      !isValidDateString(item.createdAt)
    ) {
      throw new Error("Manifesto de sincronização inválido: registro.");
    }
  }
  if (manifest.profileUpdatedAt !== undefined && !isValidDateString(manifest.profileUpdatedAt)) {
    throw new Error("Manifesto de sincronização inválido: perfil.");
  }
}

/**
 * Aplica um payload recebido ao IndexedDB local de forma incremental e segura.
 */
export async function applyIncomingPayload(
  payload: SyncPayload
): Promise<{
  activitiesReceived: number;
  gearReceived: number;
  routesReceived: number;
  profileUpdated: boolean;
}> {
  assertValidSyncPayload(payload);
  let profileUpdated = false;
  let shouldWriteProfile = false;
  if (payload.profile) {
    const current = await getUserProfile();
    shouldWriteProfile = !current || new Date(payload.profile.updatedAt).getTime() > new Date(current.updatedAt).getTime();
  }

  const db = await getStore();
  const tx = db.transaction([
    "profile",
    "gear",
    "activitySummaries",
    "activityTracks",
    "routes",
    "dashboardStats",
  ], "readwrite");
  const summaryStore = tx.objectStore("activitySummaries");
  const incomingActivities = new Map<string, {
    activity: StoredActivity;
    summary: ReturnType<typeof toActivitySummary>;
  }>();
  for (const act of payload.activities ?? []) {
    incomingActivities.set(act.id, {
      activity: act,
      summary: toActivitySummary(act),
    });
  }

  const entries = Array.from(incomingActivities.values());
  const [previousSummaries, currentAggregate] = await Promise.all([
    Promise.all(entries.map(({ summary }) => summaryStore.get(summary.id))),
    tx.objectStore("dashboardStats").get(DASHBOARD_STATS_KEY),
  ]);
  const aggregate =
    currentAggregate ?? createDashboardStatsAggregate(await summaryStore.getAll());
  let nextAggregate = aggregate;

  for (const [index, { activity, summary }] of entries.entries()) {
    nextAggregate = applyDashboardStatsDelta(
      nextAggregate,
      previousSummaries[index],
      summary,
    );
    const track: StoredActivityTrack = {
      id: activity.id,
      points: activity.points,
      trackSegments: activity.trackSegments,
      maxPaceSecKm: activity.maxPaceSecKm,
      maxHr: activity.maxHr,
      notes: activity.notes,
      workoutId: activity.workoutId,
      structuredWorkoutReport: activity.structuredWorkoutReport,
    };
    summaryStore.put(summary);
    tx.objectStore("activityTracks").put(track);
  }
  for (const gear of payload.gear ?? []) tx.objectStore("gear").put(gear);
  for (const route of payload.routes ?? []) tx.objectStore("routes").put(route);
  if (shouldWriteProfile && payload.profile) {
    tx.objectStore("profile").put(payload.profile, PROFILE_KEY);
    profileUpdated = true;
  }
  tx.objectStore("dashboardStats").put(
    nextAggregate,
    DASHBOARD_STATS_KEY,
  );
  await tx.done;

  return {
    activitiesReceived: payload.activities?.length ?? 0,
    gearReceived: payload.gear?.length ?? 0,
    routesReceived: payload.routes?.length ?? 0,
    profileUpdated,
  };
}

/**
 * Executa merge bidirecional completo de um cofre remoto (WebDAV / Arquivo Vault).
 * Retorna o cofre unificado para ser reenviado à nuvem, além das contagens aplicadas localmente.
 */
export async function mergeVaultWithLocal(
  remoteVault: SyncPayload
): Promise<{
  unifiedVault: SyncPayload;
  report: SyncReport;
}> {
  assertValidSyncPayload(remoteVault);
  const localActivities = await getAllStoredActivities();
  const localGear = await getAllStoredGear();
  const localRoutes = await getAllStoredRoutes();
  const localProfile = await getUserProfile();

  const remoteActivities = remoteVault.activities || [];
  const remoteGear = remoteVault.gear || [];
  const remoteRoutes = remoteVault.routes || [];
  const remoteProfile = remoteVault.profile || null;

  // Unificação de Atividades
  const activityMap = new Map<string, StoredActivity>();
  for (const a of localActivities) activityMap.set(a.id, a);
  let activitiesReceived = 0;
  let activitiesSent = 0;

  for (const ra of remoteActivities) {
    if (!activityMap.has(ra.id)) {
      await putActivity(ra);
      activityMap.set(ra.id, ra);
      activitiesReceived++;
    }
  }
  activitiesSent = localActivities.filter(
    (la) => !remoteActivities.some((ra) => ra.id === la.id)
  ).length;

  // Unificação de Equipamentos
  const gearMap = new Map<string, Gear>();
  for (const g of localGear) gearMap.set(g.id, g);
  let gearReceived = 0;
  let gearSent = 0;

  for (const rg of remoteGear) {
    if (!gearMap.has(rg.id)) {
      await putGear(rg);
      gearMap.set(rg.id, rg);
      gearReceived++;
    }
  }
  gearSent = localGear.filter(
    (lg) => !remoteGear.some((rg) => rg.id === lg.id)
  ).length;

  // Unificação de Rotas
  const routeMap = new Map<string, SavedRoute>();
  for (const r of localRoutes) routeMap.set(r.id, r);
  let routesReceived = 0;
  let routesSent = 0;

  for (const rr of remoteRoutes) {
    if (!routeMap.has(rr.id)) {
      await putRoute(rr);
      routeMap.set(rr.id, rr);
      routesReceived++;
    }
  }
  routesSent = localRoutes.filter(
    (lr) => !remoteRoutes.some((rr) => rr.id === lr.id)
  ).length;

  // Unificação de Perfil
  let unifiedProfile: UserProfile | null = localProfile;
  let profileUpdated = false;

  if (remoteProfile) {
    if (
      !localProfile ||
      new Date(remoteProfile.updatedAt).getTime() >
        new Date(localProfile.updatedAt).getTime()
    ) {
      await saveUserProfileSnapshot(remoteProfile);
      unifiedProfile = remoteProfile;
      profileUpdated = true;
    }
  }

  const unifiedVault: SyncPayload = {
    profile: unifiedProfile,
    gear: Array.from(gearMap.values()),
    activities: Array.from(activityMap.values()),
    routes: Array.from(routeMap.values()),
  };
  assertValidSyncPayload(unifiedVault);

  const report: SyncReport = {
    activitiesReceived,
    activitiesSent,
    gearReceived,
    gearSent,
    routesReceived,
    routesSent,
    profileUpdated,
    timestamp: new Date().toISOString(),
  };

  return { unifiedVault, report };
}
