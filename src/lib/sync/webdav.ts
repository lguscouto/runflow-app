import type { WebDavConfig, SyncReport, SyncPayload } from "../types";
import {
  getAllStoredActivities,
  getAllStoredGear,
  getAllStoredRoutes,
} from "../storage";
import { getUserProfile } from "../profile";
import { assertValidSyncPayload, mergeVaultWithLocal } from "./merger";

const WEBDAV_CONFIG_KEY = "runflow_webdav_config";
const MAX_WEBDAV_BODY_BYTES = 10 * 1024 * 1024;
const WEBDAV_TIMEOUT_MS = 15_000;

export function getWebDavConfig(): WebDavConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(WEBDAV_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WebDavConfig;
    const { password: _legacyPassword, ...safeConfig } = parsed;
    if (_legacyPassword !== undefined) {
      localStorage.setItem(WEBDAV_CONFIG_KEY, JSON.stringify(safeConfig));
    }
    return safeConfig;
  } catch {
    return null;
  }
}

export function saveWebDavConfig(config: WebDavConfig): void {
  if (typeof window === "undefined") return;
  const { password: _password, ...safeConfig } = config;
  localStorage.setItem(WEBDAV_CONFIG_KEY, JSON.stringify(safeConfig));
}

export function markWebDavConfigSynced(
  config: WebDavConfig,
  syncedAt = new Date().toISOString(),
): WebDavConfig {
  return { ...config, lastSyncedAt: syncedAt };
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

function byteLength(text: string): number {
  return typeof TextEncoder !== "undefined" ? new TextEncoder().encode(text).byteLength : text.length * 2;
}

async function awaitWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) throw new Error("Operação abortada.");

  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const onAbort = () => {
      cleanup();
      reject(new Error("Operação abortada."));
    };

    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
  });
}

async function readResponseTextLimited(
  response: Response,
  signal?: AbortSignal,
): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBDAV_BODY_BYTES) {
    try {
      await response.body?.cancel();
    } catch {
      // O corpo já foi rejeitado; a falha de cancelamento não deve mascarar o limite.
    }
    throw new Error("Resposta WebDAV excede o limite de tamanho permitido.");
  }
  if (!response.body) {
    const text = await awaitWithAbort(response.text(), signal);
    if (byteLength(text) > MAX_WEBDAV_BODY_BYTES) {
      throw new Error("Resposta WebDAV excede o limite de tamanho permitido.");
    }
    return text;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let completed = false;
  let cancelPromise: Promise<void> | null = null;
  const cancelReader = () => {
    if (cancelPromise) return cancelPromise;
    cancelPromise = (async () => {
      const cancel = (reader as ReadableStreamDefaultReader<Uint8Array> & {
        cancel?: () => Promise<void>;
      }).cancel;
      if (typeof cancel === "function") {
        await Promise.resolve(cancel.call(reader)).catch(() => undefined);
      }
    })();
    return cancelPromise;
  };
  const cancelOnAbort = () => {
    void cancelReader();
  };
  signal?.addEventListener("abort", cancelOnAbort, { once: true });
  try {
    while (true) {
      const { done, value } = await awaitWithAbort(reader.read(), signal);
      if (done) {
        completed = true;
        break;
      }
      const chunk = new Uint8Array(value);
      total += chunk.byteLength;
      if (total > MAX_WEBDAV_BODY_BYTES) {
        throw new Error("Resposta WebDAV excede o limite de tamanho permitido.");
      }
      chunks.push(chunk);
    }
  } finally {
    signal?.removeEventListener("abort", cancelOnAbort);
    if (!completed) await cancelReader();
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function withWebDavTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBDAV_TIMEOUT_MS);
  try {
    return await operation(controller.signal);
  } catch (err) {
    if (controller.signal.aborted) throw new Error("Tempo limite excedido na operação WebDAV.");
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  return withWebDavTimeout((signal) => fetch(input, { ...init, signal }));
}

/**
 * Executa a sincronização bidirecional com o servidor WebDAV (Nextcloud, ownCloud, etc.)
 */
export async function syncWebDav(config: WebDavConfig): Promise<SyncReport> {
  const { serverUrl, username, password = "", remotePath } = config;

  if (!serverUrl || !username) {
    throw new Error("URL do servidor e usuário são obrigatórios.");
  }
  let parsedServerUrl: URL;
  try {
    parsedServerUrl = new URL(serverUrl);
  } catch {
    throw new Error("A URL do servidor WebDAV é inválida.");
  }
  if (parsedServerUrl.protocol !== "https:") {
    throw new Error("O WebDAV exige uma URL HTTPS para proteger as credenciais.");
  }

  const targetUrl = normalizeUrl(serverUrl, remotePath || "runflow/vault.json");
  const authHeader = buildBasicAuthHeader(username, password);

  let remoteVault: SyncPayload | null = null;

  // 1. Busca o cofre existente. Somente 404 permite um primeiro envio.
  let getRes: Response;
  try {
    getRes = await fetchWithTimeout(targetUrl, {
      method: "GET",
      headers: {
        Authorization: authHeader,
      },
    });
  } catch (err) {
    throw new Error(
      `Falha ao ler o cofre remoto antes do sync: ${err instanceof Error ? err.message : "erro de rede"}`
    );
  }

  if (getRes.status === 401 || getRes.status === 403) {
    throw new Error("Credenciais do WebDAV incorretas ou sem permissão de acesso.");
  }
  if (getRes.status === 404) {
    remoteVault = null;
  } else if (!getRes.ok) {
    throw new Error(`Falha ao ler o cofre remoto (HTTP ${getRes.status} ${getRes.statusText}).`);
  } else {
    const text = await withWebDavTimeout((signal) =>
      readResponseTextLimited(getRes, signal),
    );
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Cofre remoto com JSON inválido; upload abortado para proteger os dados.");
    }
    assertValidSyncPayload(parsed);
    remoteVault = parsed;
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

  assertValidSyncPayload(finalVault);
  const serializedVault = JSON.stringify(finalVault, null, 2);
  if (byteLength(serializedVault) > MAX_WEBDAV_BODY_BYTES) {
    throw new Error("Cofre unificado excede o limite de tamanho permitido.");
  }

  // 4. Salva o cofre unificado de volta no servidor WebDAV
  const putRes = await fetchWithTimeout(targetUrl, {
    method: "PUT",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: serializedVault,
  });

  if (!putRes.ok) {
    throw new Error(
      `Falha ao salvar no servidor WebDAV (HTTP ${putRes.status} ${putRes.statusText}). Certifique-se de que a pasta de destino existe.`
    );
  }

  // Atualiza data do último sync
  saveWebDavConfig(markWebDavConfigSynced(config));

  return report;
}
