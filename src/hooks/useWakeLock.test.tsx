/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useWakeLock } from "./useWakeLock";

type FakeSentinel = {
  release: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  emitRelease: () => void;
};

function makeSentinel(): FakeSentinel {
  let releaseListener: (() => void) | undefined;
  return {
    release: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn((type: string, listener: () => void) => {
      if (type === "release") releaseListener = listener;
    }),
    emitRelease: () => releaseListener?.(),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

describe("useWakeLock lifecycle", () => {
  let request: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    request = vi.fn();
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: { request },
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "wakeLock");
  });

  it("releases a lock that resolves after the hook becomes inactive", async () => {
    const pending = deferred<FakeSentinel>();
    const sentinel = makeSentinel();
    request.mockReturnValueOnce(pending.promise);
    const { rerender } = renderHook(({ active }) => useWakeLock(active), {
      initialProps: { active: true },
    });

    rerender({ active: false });
    pending.resolve(sentinel);
    await act(async () => {
      await pending.promise;
    });

    expect(sentinel.release).toHaveBeenCalledTimes(1);
  });

  it("does not issue a concurrent request across active toggles", async () => {
    const pending = deferred<FakeSentinel>();
    request.mockReturnValueOnce(pending.promise);
    const { rerender } = renderHook(({ active }) => useWakeLock(active), {
      initialProps: { active: true },
    });

    rerender({ active: false });
    rerender({ active: true });

    expect(request).toHaveBeenCalledTimes(1);
    pending.resolve(makeSentinel());
    await act(async () => {
      await pending.promise;
    });
  });

  it("keeps the release listener when reacquiring after visibility changes", async () => {
    const first = makeSentinel();
    const second = makeSentinel();
    const third = makeSentinel();
    request
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second)
      .mockResolvedValueOnce(third);
    renderHook(() => useWakeLock(true));

    await act(async () => {
      await Promise.resolve();
    });
    first.emitRelease();
    document.dispatchEvent(new Event("visibilitychange"));
    await act(async () => {
      await Promise.resolve();
    });
    second.emitRelease();
    document.dispatchEvent(new Event("visibilitychange"));
    await act(async () => {
      await Promise.resolve();
    });

    expect(request).toHaveBeenCalledTimes(3);
  });

  it("reacquires the lock after the StrictMode effect probe", async () => {
    const sentinel = makeSentinel();
    request.mockResolvedValue(sentinel);

    renderHook(() => useWakeLock(true), {
      wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(request).toHaveBeenCalledTimes(1);
    expect(sentinel.addEventListener).toHaveBeenCalled();
    expect(sentinel.release).not.toHaveBeenCalled();
  });
});