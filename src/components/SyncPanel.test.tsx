/** @vitest-environment jsdom */
import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SyncPanel } from "./SyncPanel";
import {
  getWebDavConfig,
  markWebDavConfigSynced,
  saveWebDavConfig,
  syncWebDav,
} from "@/lib/sync/webdav";

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    language: "pt",
    t: (key: string) => key,
  }),
}));

vi.mock("@/lib/sync/p2p", () => ({
  generatePairingToken: vi.fn(() => "pairing-token"),
  P2PHostSession: class {},
  P2PJoinerSession: class {},
}));

vi.mock("@/lib/local-network", () => ({
  isLocalNetworkPermissionGranted: vi.fn(() => true),
  requestLocalNetworkPermissionStatus: vi.fn(async () => "granted"),
}));

vi.mock("@/lib/sync/webdav", () => ({
  getWebDavConfig: vi.fn(),
  markWebDavConfigSynced: vi.fn(),
  saveWebDavConfig: vi.fn(),
  syncWebDav: vi.fn(),
}));

const report = {
  activitiesReceived: 1,
  activitiesSent: 2,
  gearReceived: 0,
  gearSent: 0,
  routesReceived: 0,
  routesSent: 0,
  profileUpdated: false,
  timestamp: "2026-08-25T17:00:00.000Z",
};

describe("SyncPanel lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getWebDavConfig).mockReturnValue(null);
    vi.mocked(syncWebDav).mockResolvedValue(report);
    vi.mocked(markWebDavConfigSynced).mockImplementation((config) => ({
      ...config,
      lastSyncedAt: "2026-08-25T17:00:00.000Z",
    }));
  });

  it("finishes and persists a successful WebDAV sync under StrictMode", async () => {
    render(
      <StrictMode>
        <SyncPanel />
      </StrictMode>,
    );

    const webdavTab = screen.getByRole("tab", { name: "sync.tab_webdav" });
    expect(webdavTab.getAttribute("aria-controls")).toBe("sync-panel-webdav");
    expect(webdavTab.getAttribute("aria-selected")).toBe("false");
    fireEvent.click(webdavTab);
    expect(webdavTab.getAttribute("aria-selected")).toBe("true");
    fireEvent.change(screen.getByPlaceholderText("sync.webdav_server_placeholder"), {
      target: { value: "https://dav.example.test" },
    });
    fireEvent.change(screen.getByPlaceholderText("sync.webdav_user_placeholder"), {
      target: { value: "runner" },
    });
    fireEvent.click(screen.getByRole("button", { name: "sync.webdav_sync_now" }));

    await waitFor(() => expect(syncWebDav).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(saveWebDavConfig).toHaveBeenCalledTimes(1));

    expect(screen.getByText("sync.report_title")).not.toBeNull();
    expect(screen.getByText("sync.last_synced")).not.toBeNull();
    const syncButton = screen.getByRole("button", {
      name: "sync.webdav_sync_now",
    }) as HTMLButtonElement;
    expect(syncButton.disabled).toBe(false);
  });
});
