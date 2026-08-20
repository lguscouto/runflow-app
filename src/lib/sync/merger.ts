import {
  getStore,
  PROFILE_KEY,
  getAllStoredActivities,
  getAllStoredGear,
  getAllStoredRoutes,
  putActivity,
  putGear,
  putRoute,
  type StoredActivity,
} from "../storage";
import { getUserProfile, saveUserProfile } from "../profile";
import type {
  SyncManifest,
  SyncPayload,
  SyncReport,
  UserProfile,
  Gear,
  SavedRoute,
} from "../types";

/**
 * Obtém ou gera um ID único para este dispositivo local no localStorage.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "server-instance";
  const KEY = "runflow_device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = "dev_" + Math.random().toString(36).substring(2, 10);
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
  let activitiesReceived = 0;
  let gearReceived = 0;
  let routesReceived = 0;
  let profileUpdated = false;

  // 1. Atividades
  if (Array.isArray(payload.activities) && payload.activities.length > 0) {
    for (const act of payload.activities) {
      await putActivity(act);
      activitiesReceived++;
    }
  }

  // 2. Equipamentos (Tênis)
  if (Array.isArray(payload.gear) && payload.gear.length > 0) {
    for (const g of payload.gear) {
      await putGear(g);
      gearReceived++;
    }
  }

  // 3. Rotas Salvas
  if (Array.isArray(payload.routes) && payload.routes.length > 0) {
    for (const r of payload.routes) {
      await putRoute(r);
      routesReceived++;
    }
  }

  // 4. Perfil
  if (payload.profile) {
    const current = await getUserProfile();
    if (
      !current ||
      new Date(payload.profile.updatedAt).getTime() >
        new Date(current.updatedAt).getTime()
    ) {
      await saveUserProfile(payload.profile);
      profileUpdated = true;
    }
  }

  return {
    activitiesReceived,
    gearReceived,
    routesReceived,
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
      await saveUserProfile(remoteProfile);
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
