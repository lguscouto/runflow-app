import { describe, it, expect } from "vitest";
import {
  checkLocalNetworkPermission,
  createLocalNetworkPermissionBridge,
  getLocalNetworkPermissionStatus,
  isLocalNetworkPermissionDenied,
  isLocalNetworkPermissionGranted,
  requestLocalNetworkPermission,
  requestLocalNetworkPermissionStatus,
  type LocalNetworkPermissionPluginInterface,
} from "./local-network";

describe("Local Network Permission Bridge", () => {
  it("treats browser execution as granted because the native permission is not required", async () => {
    expect(await getLocalNetworkPermissionStatus()).toBe("granted");
    expect(await requestLocalNetworkPermissionStatus()).toBe("granted");
  });

  it("returns a boolean for checkLocalNetworkPermission", async () => {
    const granted = await checkLocalNetworkPermission();
    expect(typeof granted).toBe("boolean");
  });

  it("returns a boolean for requestLocalNetworkPermission", async () => {
    const granted = await requestLocalNetworkPermission();
    expect(typeof granted).toBe("boolean");
  });

  it("preserves denied and unavailable states instead of granting on bridge errors", async () => {
    const deniedPlugin: LocalNetworkPermissionPluginInterface = {
      checkPermission: async () => ({ status: "denied" }),
      requestPermission: async () => ({ status: "rationale" }),
    };
    const unavailablePlugin: LocalNetworkPermissionPluginInterface = {
      checkPermission: async () => {
        throw new Error("plugin unavailable");
      },
      requestPermission: async () => {
        throw new Error("plugin unavailable");
      },
    };

    const deniedBridge = createLocalNetworkPermissionBridge(deniedPlugin);
    const unavailableBridge = createLocalNetworkPermissionBridge(unavailablePlugin);

    expect(await deniedBridge.check()).toBe("denied");
    expect(await deniedBridge.request()).toBe("rationale");
    expect(await unavailableBridge.check()).toBe("unavailable");
    expect(await unavailableBridge.request()).toBe("unavailable");
    expect(isLocalNetworkPermissionDenied("denied")).toBe(true);
    expect(isLocalNetworkPermissionDenied("rationale")).toBe(false);
    expect(isLocalNetworkPermissionDenied("unavailable")).toBe(false);
    expect(isLocalNetworkPermissionGranted("granted")).toBe(true);
    expect(isLocalNetworkPermissionGranted("denied")).toBe(false);
    expect(isLocalNetworkPermissionGranted("rationale")).toBe(false);
    expect(isLocalNetworkPermissionGranted("unavailable")).toBe(false);
  });
});
