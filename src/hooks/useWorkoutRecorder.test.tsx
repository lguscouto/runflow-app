/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useWorkoutRecorder } from "./useWorkoutRecorder";

const mocks = vi.hoisted(() => ({
  saveActivity: vi.fn(),
  getActivity: vi.fn(),
  requestLocationPermission: vi.fn(),
  getCurrentPosition: vi.fn(),
  startWatchingPosition: vi.fn(),
  getUserProfile: vi.fn(),
  saveUserProfile: vi.fn(),
  getStoredRoute: vi.fn(),
  getAllStoredGear: vi.fn(),
}));

vi.mock("@/lib/activities", () => ({
  saveActivity: mocks.saveActivity,
  getActivity: mocks.getActivity,
}));

vi.mock("@/lib/location", () => ({
  requestLocationPermission: mocks.requestLocationPermission,
  getCurrentPosition: mocks.getCurrentPosition,
  startWatchingPosition: mocks.startWatchingPosition,
}));

vi.mock("@/lib/profile", () => ({
  getUserProfile: mocks.getUserProfile,
  saveUserProfile: mocks.saveUserProfile,
}));

vi.mock("@/lib/storage", () => ({
  getStoredRoute: mocks.getStoredRoute,
  getAllStoredGear: mocks.getAllStoredGear,
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    language: "pt",
    t: (key: string) => key,
  }),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
  registerPlugin: vi.fn(() => ({})),
}));

vi.mock("@capacitor-community/bluetooth-le", () => ({
  BleClient: {
    initialize: vi.fn().mockResolvedValue(undefined),
    requestDevice: vi.fn(),
    connect: vi.fn(),
    startNotifications: vi.fn(),
    stopNotifications: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(undefined),
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useWorkoutRecorder lifecycle", () => {
  let onPosition: ((position: { lat: number; lng: number; elevation?: number; accuracy?: number }) => void) | undefined;
  let stopWatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-25T12:00:00.000Z"));
    onPosition = undefined;
    stopWatch = vi.fn();
    mocks.saveActivity.mockReset().mockResolvedValue("activity-1");
    mocks.getActivity.mockReset().mockResolvedValue(null);
    mocks.requestLocationPermission.mockReset().mockResolvedValue(true);
    mocks.getCurrentPosition.mockReset().mockResolvedValue(null);
    mocks.startWatchingPosition.mockReset().mockImplementation(async (callback) => {
      onPosition = callback;
      return stopWatch;
    });
    mocks.getUserProfile.mockReset().mockResolvedValue(null);
    mocks.saveUserProfile.mockReset().mockResolvedValue(undefined);
    mocks.getStoredRoute.mockReset().mockResolvedValue(null);
    mocks.getAllStoredGear.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("excludes a completed manual pause from saved elapsed and moving time", async () => {
    const { result } = renderHook(() => useWorkoutRecorder());

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe("recording");

    await act(async () => {
      onPosition?.({ lat: -22.9000, lng: -43.2000 });
      vi.advanceTimersByTime(10_000);
      onPosition?.({ lat: -22.9000, lng: -43.2005 });
    });

    await act(async () => {
      result.current.pause();
    });
    expect(result.current.status).toBe("paused");

    await act(async () => {
      vi.advanceTimersByTime(10_000);
      const resumed = await result.current.resume();
      expect(resumed).toBe(true);
    });

    await act(async () => {
      vi.advanceTimersByTime(10_000);
      onPosition?.({ lat: -22.9000, lng: -43.2010 });
    });

    await act(async () => {
      const id = await result.current.stop();
      expect(id).toBe("activity-1");
    });

    const saved = mocks.saveActivity.mock.calls[0]?.[0];
    expect(saved.durationSec).toBe(20);
    expect(saved.elapsedTimeSec).toBe(20);
    expect(saved.movingTimeSec).toBe(20);
    expect(mocks.saveActivity).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("idle");
  });

  it("stops directly from manual pause without counting the paused interval", async () => {
    const { result } = renderHook(() => useWorkoutRecorder());

    await act(async () => {
      await result.current.start();
      onPosition?.({ lat: -22.9000, lng: -43.2000 });
      vi.advanceTimersByTime(20_000);
      onPosition?.({ lat: -22.9000, lng: -43.2010 });
    });

    await act(async () => {
      result.current.pause();
    });
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.status).toBe("paused");

    await act(async () => {
      await expect(result.current.stop()).resolves.toBe("activity-1");
    });

    const saved = mocks.saveActivity.mock.calls[0]?.[0];
    expect(saved.durationSec).toBe(20);
    expect(saved.movingTimeSec).toBe(20);
    expect(result.current.status).toBe("idle");
  });

  it("does not undercount moving time when interval ticks are delayed", async () => {
    const { result } = renderHook(() => useWorkoutRecorder());

    await act(async () => {
      await result.current.start();
      onPosition?.({ lat: -22.9000, lng: -43.2000 });
    });
    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current.stats.movingSec).toBe(1);

    await act(async () => {
      vi.setSystemTime(new Date("2026-08-25T12:00:20.000Z"));
      onPosition?.({ lat: -22.9000, lng: -43.2010 });
    });

    await act(async () => {
      await result.current.stop();
    });

    const saved = mocks.saveActivity.mock.calls[0]?.[0];
    expect(saved.durationSec).toBe(20);
    expect(saved.movingTimeSec).toBe(20);
  });

  it("does not issue a second save while the first stop is still saving", async () => {
    const save = deferred<string>();
    mocks.saveActivity.mockReturnValueOnce(save.promise);
    const { result } = renderHook(() => useWorkoutRecorder());

    await act(async () => {
      await result.current.start();
      onPosition?.({ lat: -22.9000, lng: -43.2000 });
      vi.advanceTimersByTime(20_000);
      onPosition?.({ lat: -22.9000, lng: -43.2010 });
    });

    let firstStop!: Promise<string | null>;
    let secondStop!: Promise<string | null>;
    await act(async () => {
      firstStop = result.current.stop();
      secondStop = result.current.stop();
      expect(await secondStop).toBeNull();
      save.resolve("activity-1");
      expect(await firstStop).toBe("activity-1");
    });

    expect(mocks.saveActivity).toHaveBeenCalledTimes(1);
  });

  it("keeps the workout paused and retryable when saving fails", async () => {
    mocks.saveActivity
      .mockRejectedValueOnce(new Error("disk full"))
      .mockResolvedValueOnce("activity-2");
    const { result } = renderHook(() => useWorkoutRecorder());

    await act(async () => {
      await result.current.start();
      onPosition?.({ lat: -22.9000, lng: -43.2000 });
      vi.advanceTimersByTime(20_000);
      onPosition?.({ lat: -22.9000, lng: -43.2010 });
    });

    await act(async () => {
      await expect(result.current.stop()).resolves.toBeNull();
    });
    expect(result.current.status).toBe("paused");
    expect(result.current.error).toBe("disk full");

    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await expect(result.current.stop()).resolves.toBe("activity-2");
    });

    expect(mocks.saveActivity).toHaveBeenCalledTimes(2);
    expect(mocks.saveActivity.mock.calls[1]?.[0].durationSec).toBe(20);
    expect(result.current.status).toBe("idle");
  });

  it("does not update React state after unmount during an in-flight save", async () => {
    const save = deferred<string>();
    mocks.saveActivity.mockReturnValueOnce(save.promise);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result, unmount } = renderHook(() => useWorkoutRecorder());

    await act(async () => {
      await result.current.start();
      onPosition?.({ lat: -22.9000, lng: -43.2000 });
      vi.advanceTimersByTime(20_000);
      onPosition?.({ lat: -22.9000, lng: -43.2010 });
    });

    let stopPromise!: Promise<string | null>;
    await act(async () => {
      stopPromise = result.current.stop();
    });
    unmount();

    await act(async () => {
      save.resolve("activity-1");
      await stopPromise;
    });

    expect(consoleError).not.toHaveBeenCalledWith(expect.stringMatching(/unmounted|update.*state/i));
    consoleError.mockRestore();
  });
});
