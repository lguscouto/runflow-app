import { describe, expect, it } from "vitest";
import { createGpsWatchLifecycle, createMountedLifecycle } from "./gps-watch-lifecycle";

describe("GPS watch lifecycle", () => {
  it("invalidates an async watcher that resolves after stop", () => {
    const lifecycle = createGpsWatchLifecycle();
    const token = lifecycle.begin();

    lifecycle.invalidate();

    expect(lifecycle.isCurrent(token)).toBe(false);
  });

  it("keeps only the newest watcher generation current", () => {
    const lifecycle = createGpsWatchLifecycle();
    const first = lifecycle.begin();
    const second = lifecycle.begin();

    expect(lifecycle.isCurrent(first)).toBe(false);
    expect(lifecycle.isCurrent(second)).toBe(true);
  });

  it("reactivates after the development Strict Mode cleanup cycle", () => {
    const lifecycle = createMountedLifecycle();

    lifecycle.unmount();
    expect(lifecycle.isMounted()).toBe(false);

    lifecycle.mount();
    expect(lifecycle.isMounted()).toBe(true);
  });
});