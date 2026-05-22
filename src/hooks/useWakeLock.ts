"use client";

import { useEffect, useRef } from "react";

/**
 * useWakeLock — keeps the screen on while `active` is true.
 * Uses the Screen Wake Lock API (Chrome 84+, Edge 84+, Samsung Internet 14+).
 * Fails silently on unsupported browsers (Firefox, older Safari).
 */
export function useWakeLock(active: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    async function acquireLock() {
      try {
        if (wakeLockRef.current) return; // already held
        wakeLockRef.current = await (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock.request("screen");

        // Re-acquire if the lock is released by the system (e.g. tab hidden)
        wakeLockRef.current.addEventListener("release", () => {
          wakeLockRef.current = null;
        });
      } catch {
        // Not all environments support wake lock — fail silently
        wakeLockRef.current = null;
      }
    }

    async function releaseLock() {
      try {
        if (wakeLockRef.current) {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
        }
      } catch {
        wakeLockRef.current = null;
      }
    }

    if (active) {
      acquireLock();
    } else {
      releaseLock();
    }

    return () => {
      releaseLock();
    };
  }, [active]);

  // Re-acquire when tab becomes visible again (browser releases lock on hide)
  useEffect(() => {
    if (!active) return;
    if (typeof document === "undefined") return;
    if (!("wakeLock" in navigator)) return;

    async function handleVisibilityChange() {
      if (document.visibilityState === "visible" && !wakeLockRef.current) {
        try {
          wakeLockRef.current = await (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock.request("screen");
        } catch {
          // ignore
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [active]);
}
