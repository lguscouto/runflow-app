/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getWebDavConfig,
  markWebDavConfigSynced,
  saveWebDavConfig,
  syncWebDav,
} from "./webdav";

describe("WebDAV credential and transport safety", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("does not persist the WebDAV password in localStorage", () => {
    saveWebDavConfig({
      serverUrl: "https://dav.example.test",
      username: "gustavo",
      password: "secret-for-test",
      remotePath: "runflow/vault.json",
    });

    expect(localStorage.getItem("runflow_webdav_config")).not.toContain("secret-for-test");
    expect(getWebDavConfig()?.password).toBeUndefined();
  });

  it("keeps the sync timestamp when the panel persists its connection config", () => {
    const syncedAt = "2026-08-25T14:00:00.000Z";
    const config = {
      serverUrl: "https://dav.example.test",
      username: "gustavo",
      password: "[REDACTED]",
      remotePath: "runflow/vault.json",
    };

    expect(markWebDavConfigSynced(config, syncedAt)).toEqual({
      ...config,
      lastSyncedAt: syncedAt,
    });
  });

  it("rejects non-HTTPS WebDAV before sending Basic Auth", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      syncWebDav({
        serverUrl: "http://dav.example.test",
        username: "gustavo",
        password: "secret-for-test",
        remotePath: "runflow/vault.json",
      })
    ).rejects.toThrow(/HTTPS/);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not overwrite the remote vault after a non-404 GET failure", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("temporarily unavailable", { status: 503 }),
    );

    await expect(
      syncWebDav({
        serverUrl: "https://dav.example.test",
        username: "gustavo",
        password: "[REDACTED]",
        remotePath: "runflow/vault.json",
      }),
    ).rejects.toThrow(/HTTP 503/);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not overwrite the remote vault when its JSON is invalid", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not-json", { status: 200 }),
    );

    await expect(
      syncWebDav({
        serverUrl: "https://dav.example.test",
        username: "gustavo",
        password: "[REDACTED]",
        remotePath: "runflow/vault.json",
      }),
    ).rejects.toThrow(/JSON|cofre|payload/i);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a remote response larger than the limit before parsing JSON", async () => {
    const declaredBodyCancel = vi.fn(async () => undefined);
    const streamedReader = {
      read: vi.fn(async () => ({
        done: false,
        value: new Uint8Array(10 * 1024 * 1024 + 1),
      })),
      releaseLock: vi.fn(),
      cancel: vi.fn(async () => undefined),
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      status: 200,
      ok: true,
      statusText: "OK",
      headers: new Headers([["content-length", String(10 * 1024 * 1024 + 1)]]),
      body: {
        cancel: declaredBodyCancel,
        getReader: () => streamedReader,
      },
    } as unknown as Response).mockResolvedValueOnce({
      status: 200,
      ok: true,
      statusText: "OK",
      headers: new Headers(),
      body: { getReader: () => streamedReader },
    } as unknown as Response);
    const config = {
      serverUrl: "https://dav.example.test",
      username: "gustavo",
      password: "[REDACTED]",
      remotePath: "runflow/vault.json",
    };

    await expect(syncWebDav(config)).rejects.toThrow(/tamanho|limite|grande/i);
    expect(declaredBodyCancel).toHaveBeenCalled();

    await expect(syncWebDav(config)).rejects.toThrow(/tamanho|limite|grande/i);
    expect(streamedReader.cancel).toHaveBeenCalled();
    expect(streamedReader.releaseLock).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("times out when the remote response body stalls after headers", async () => {
    vi.useFakeTimers();
    const reader = {
      read: vi.fn(() => new Promise<never>(() => {})),
      releaseLock: vi.fn(),
      cancel: vi.fn(async () => undefined),
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 200,
      ok: true,
      statusText: "OK",
      headers: new Headers(),
      body: { getReader: () => reader },
    } as unknown as Response);

    try {
      const outcome = syncWebDav({
        serverUrl: "https://dav.example.test",
        username: "gustavo",
        password: "[REDACTED]",
        remotePath: "runflow/vault.json",
      }).then(
        () => "resolved",
        (error: unknown) => (error instanceof Error ? error.message : String(error)),
      );

      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(15_000);

      const result = await Promise.race([outcome, Promise.resolve("pending")]);
      expect(result).toMatch(/Tempo limite/);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(reader.cancel).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});