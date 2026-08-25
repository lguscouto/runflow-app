import { registerPlugin } from "@capacitor/core";
import { Capacitor } from "@capacitor/core";

export type LocalNetworkPermissionStatus = "granted" | "denied" | "rationale" | "unavailable";

export interface LocalNetworkPermissionPluginInterface {
  checkPermission(): Promise<{ status: LocalNetworkPermissionStatus }>;
  requestPermission(): Promise<{ status: LocalNetworkPermissionStatus }>;
}

export interface LocalNetworkPermissionBridge {
  check(): Promise<LocalNetworkPermissionStatus>;
  request(): Promise<LocalNetworkPermissionStatus>;
}

const LocalNetworkPermission = registerPlugin<LocalNetworkPermissionPluginInterface>(
  "LocalNetworkPermission"
);

function normalizeStatus(value: unknown): LocalNetworkPermissionStatus {
  if (value === "granted" || value === "denied" || value === "rationale") return value;
  return "unavailable";
}

export function createLocalNetworkPermissionBridge(
  plugin: LocalNetworkPermissionPluginInterface,
): LocalNetworkPermissionBridge {
  const call = async (
    operation: () => Promise<{ status: LocalNetworkPermissionStatus }>,
  ): Promise<LocalNetworkPermissionStatus> => {
    try {
      const result = await operation();
      return normalizeStatus(result?.status);
    } catch {
      return "unavailable";
    }
  };

  return {
    check: () => call(() => plugin.checkPermission()),
    request: () => call(() => plugin.requestPermission()),
  };
}

const permissionBridge = createLocalNetworkPermissionBridge(LocalNetworkPermission);

export function getLocalNetworkPermissionStatus(): Promise<LocalNetworkPermissionStatus> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve("granted");
  return permissionBridge.check();
}

export function requestLocalNetworkPermissionStatus(): Promise<LocalNetworkPermissionStatus> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve("granted");
  return permissionBridge.request();
}

export function isLocalNetworkPermissionDenied(
  status: LocalNetworkPermissionStatus,
): boolean {
  return status === "denied";
}

export function isLocalNetworkPermissionGranted(
  status: LocalNetworkPermissionStatus,
): boolean {
  return status === "granted";
}

export async function checkLocalNetworkPermission(): Promise<boolean> {
  return (await getLocalNetworkPermissionStatus()) === "granted";
}

export async function requestLocalNetworkPermission(): Promise<boolean> {
  return (await requestLocalNetworkPermissionStatus()) === "granted";
}
