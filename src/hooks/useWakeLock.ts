"use client";

import { useEffect, useRef } from "react";

/**
 * useWakeLock — keeps the screen on while `active` is true.
 * Uses the Screen Wake Lock API (Chrome 84+, Edge 84+, Samsung Internet 14+).
 * Fails silently on unsupported browsers (Firefox, older Safari).
 */
export function useWakeLock(active: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const pendingRequestRef = useRef<Promise<WakeLockSentinel> | null>(null);
  const activeRef = useRef(active);
  const mountedRef = useRef(true);
  activeRef.current = active;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    const wakeLock = (navigator as Navigator & {
      wakeLock: { request: (type: string) => Promise<WakeLockSentinel> };
    }).wakeLock;

    function attachReleaseListener(sentinel: WakeLockSentinel) {
      sentinel.addEventListener("release", () => {
        if (wakeLockRef.current === sentinel) wakeLockRef.current = null;
      });
    }

    async function releaseSentinel(sentinel: WakeLockSentinel) {
      try {
        await sentinel.release();
      } catch {
        // Ignore release failures during teardown.
      }
    }

    function acquireLock() {
      if (
        !activeRef.current ||
        !mountedRef.current ||
        wakeLockRef.current ||
        pendingRequestRef.current
      ) return;

      let requestPromise: Promise<WakeLockSentinel>;
      try {
        requestPromise = wakeLock.request("screen");
      } catch {
        return;
      }
      pendingRequestRef.current = requestPromise;

      void requestPromise
        .then(async (sentinel) => {
          if (pendingRequestRef.current === requestPromise) {
            pendingRequestRef.current = null;
          }
          if (!activeRef.current || !mountedRef.current) {
            await releaseSentinel(sentinel);
            return;
          }
          wakeLockRef.current = sentinel;
          attachReleaseListener(sentinel);
        })
        .catch(() => {
          if (pendingRequestRef.current === requestPromise) {
            pendingRequestRef.current = null;
          }
        });
    }

    async function releaseLock() {
      const sentinel = wakeLockRef.current;
      wakeLockRef.current = null;
      if (sentinel) await releaseSentinel(sentinel);
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") acquireLock();
    };

    if (active) {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      acquireLock();
    } else {
      void releaseLock();
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void releaseLock();
    };
  }, [active]);
}
