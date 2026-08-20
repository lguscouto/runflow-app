import type { WebDavConfig, SyncReport, SyncPayload } from "../types";
import {
  getAllStoredActivities,
  getAllStoredGear,
  getAllStoredRoutes,
} from "../storage";
import { getUserProfile } from "../profile";
import { mergeVaultWithLocal } from "./merger";

const WEBDAV_CONFIG_KEY = "runflow_webdav_config";

export function getWebDavConfig(): WebDavConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(WEBDAV_CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveWebDavConfig(config: WebDavConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(WEBDAV_CONFIG_KEY, JSON.stringify(config));
}

function buildBasicAuthHeader(user: string, pass: string): string {
  const token = typeof btoa !== "undefined"
    ? btoa(`${user}:${pass}`)
    : Buffer.from(`${user}:${pass}`).toString("base64");
  return `Basic ${token}`;
}

function normalizeUrl(baseUrl: string, path: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const cleanPath = path.replace(/^\/+/, "");
  return `${cleanBase}/${cleanPath}`;
}

/**
 * Executa a sincronização bidirecional com o servidor WebDAV (Nextcloud, ownCloud, etc.)
 */
export async function syncWebDav(config: WebDavConfig): Promise<SyncReport> {
  const { serverUrl, username, password = "", remotePath } = config;

  if (!serverUrl || !username) {
    throw new Error("URL do servidor e usuário são obrigatórios.");
  }

  const targetUrl = normalizeUrl(serverUrl, remotePath || "runflow/vault.json");
  const authHeader = buildBasicAuthHeader(username, password);

  let remoteVault: SyncPayload | null = null;

  // 1. Tenta buscar o cofre existente na nuvem
  try {
    const getRes = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Authorization: authHeader,
      },
    });

    if (getRes.status === 401 || getRes.status === 403) {
      throw new Error("Credenciais do WebDAV incorretas ou sem permissão de acesso.");
    }

    if (getRes.status === 200) {
      const text = await getRes.text();
      try {
        remoteVault = JSON.parse(text);
      } catch {
        console.warn("Cofre remoto com formato corrompido, criando novo cofre unificado.");
      }
    }
  } catch (err: any) {
    if (err.message && err.message.includes("Credenciais")) {
      throw err;
    }
    console.log("Arquivo remoto não encontrado ou inacessível, prosseguindo com upload inicial:", err);
  }

  let finalVault: SyncPayload;
  let report: SyncReport;

  if (remoteVault) {
    // 2. Mescla o cofre remoto com o banco local
    const mergeResult = await mergeVaultWithLocal(remoteVault);
    finalVault = mergeResult.unifiedVault;
    report = mergeResult.report;
  } else {
    // 3. Primeiro envio: cria o cofre com dados locais completos
    const [profile, gear, activities, routes] = await Promise.all([
      getUserProfile(),
      getAllStoredGear(),
      getAllStoredActivities(),
      getAllStoredRoutes(),
    ]);

    finalVault = {
      profile,
      gear,
      activities,
      routes,
    };

    report = {
      activitiesReceived: 0,
      activitiesSent: activities.length,
      gearReceived: 0,
      gearSent: gear.length,
      routesReceived: 0,
      routesSent: routes.length,
      profileUpdated: false,
      timestamp: new Date().toISOString(),
    };
  }

  // 4. Salva o cofre unificado de volta no servidor WebDAV
  const putRes = await fetch(targetUrl, {
    method: "PUT",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(finalVault, null, 2),
  });

  if (!putRes.ok) {
    throw new Error(
      `Falha ao salvar no servidor WebDAV (HTTP ${putRes.status} ${putRes.statusText}). Certifique-se de que a pasta de destino existe.`
    );
  }

  // Atualiza data do último sync
  const now = new Date().toISOString();
  saveWebDavConfig({
    ...config,
    lastSyncedAt: now,
  });

  return report;
}
