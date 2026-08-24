import { registerPlugin } from "@capacitor/core";

export interface LocalNetworkPermissionPluginInterface {
  checkPermission(): Promise<{ status: "granted" | "denied" }>;
  requestPermission(): Promise<{ status: "granted" | "denied" }>;
}

const LocalNetworkPermission = registerPlugin<LocalNetworkPermissionPluginInterface>(
  "LocalNetworkPermission"
);

export async function checkLocalNetworkPermission(): Promise<boolean> {
  try {
    const res = await LocalNetworkPermission.checkPermission();
    return res.status === "granted";
  } catch {
    // Fallback gracioso no navegador
    return true;
  }
}

export async function requestLocalNetworkPermission(): Promise<boolean> {
  try {
    const res = await LocalNetworkPermission.requestPermission();
    return res.status === "granted";
  } catch {
    // Fallback gracioso no navegador
    return true;
  }
}
