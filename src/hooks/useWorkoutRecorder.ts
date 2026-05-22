"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveActivity } from "@/lib/activities";
import { distanceFromPoints } from "@/lib/geo";
import {
  acceptGpsReading,
  buildRecordedActivity,
  shouldAcceptPoint,
  validateRecordedWorkout,
} from "@/lib/record-workout";
import {
  getCurrentPosition,
  requestLocationPermission,
  startWatchingPosition,
} from "@/lib/location";
import type { Sport, TrackPoint } from "@/lib/types";
import { BleClient } from "@capacitor-community/bluetooth-le";
import { Capacitor } from "@capacitor/core";

const HEART_RATE_SERVICE = "0000180d-0000-1000-8000-00805f9b34fb";
const HEART_RATE_MEASUREMENT_CHARACTERISTIC = "00002a37-0000-1000-8000-00805f9b34fb";


export type RecorderStatus = "idle" | "recording" | "paused" | "saving";

export interface RecorderStats {
  elapsedSec: number;
  distanceM: number;
  currentPaceSecKm: number | null;
  avgPaceSecKm: number | null;
}

export function useWorkoutRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [sport, setSport] = useState<Sport>("running");
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [stats, setStats] = useState<RecorderStats>({
    elapsedSec: 0,
    distanceM: 0,
    currentPaceSecKm: null,
    avgPaceSecKm: null,
  });
  const [error, setError] = useState<string | null>(null);

  // Bluetooth HR States
  const [hrStatus, setHrStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [hrBpm, setHrBpm] = useState<number | null>(null);
  const [hrDeviceName, setHrDeviceName] = useState<string | null>(null);
  const [hrSupported, setHrSupported] = useState<boolean>(false);

  const startedAtRef = useRef<Date | null>(null);
  const pausedAtRef = useRef<Date | null>(null);
  const totalPausedMsRef = useRef(0);
  const pointsRef = useRef<TrackPoint[]>([]);
  const stopWatchRef = useRef<(() => void) | null>(null);
  const lastPaceRef = useRef<{ dist: number; time: number } | null>(null);

  // Bluetooth HR Refs
  const currentHrRef = useRef<number | null>(null);
  const hrDeviceIdRef = useRef<string | null>(null);

  // Check Bluetooth support on mount
  useEffect(() => {
    const initBle = async () => {
      if (typeof window === "undefined") {
        setHrSupported(false);
        return;
      }

      const isNative = Capacitor.isNativePlatform();
      const hasWebBle = (navigator as any).bluetooth !== undefined;

      if (isNative || hasWebBle) {
        try {
          await BleClient.initialize();
          setHrSupported(true);
        } catch (err) {
          console.error("Error initializing BleClient:", err);
          setHrSupported(false);
        }
      } else {
        setHrSupported(false);
      }
    };
    initBle();
  }, []);


  const recomputeStats = useCallback((pts: TrackPoint[], elapsedSec: number) => {
    const distanceM = distanceFromPoints(pts);
    let avgPaceSecKm: number | null = null;
    if (distanceM > 0 && elapsedSec > 0) {
      avgPaceSecKm = (elapsedSec / distanceM) * 1000;
    }

    let currentPaceSecKm: number | null = null;
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    if (last?.timestamp && prev?.timestamp) {
      const segDist = distanceFromPoints([prev, last]);
      const segTime =
        (last.timestamp.getTime() - prev.timestamp.getTime()) / 1000;
      if (segDist > 0 && segTime > 0) {
        currentPaceSecKm = (segTime / segDist) * 1000;
      }
    }

    setStats({
      elapsedSec,
      distanceM,
      currentPaceSecKm,
      avgPaceSecKm,
    });
  }, []);

  const getElapsedSec = useCallback(() => {
    if (!startedAtRef.current) return 0;
    const now = Date.now();
    const end = status === "paused" && pausedAtRef.current
      ? pausedAtRef.current.getTime()
      : now;
    const raw = (end - startedAtRef.current.getTime()) / 1000;
    return Math.max(0, raw - totalPausedMsRef.current / 1000);
  }, [status]);

  useEffect(() => {
    if (status !== "recording") return;
    const tick = setInterval(() => {
      recomputeStats(pointsRef.current, getElapsedSec());
    }, 1000);
    return () => clearInterval(tick);
  }, [status, recomputeStats, getElapsedSec]);

  const addPoint = useCallback(
    (lat: number, lng: number, elevation?: number, accuracy?: number) => {
      if (!acceptGpsReading(accuracy)) return;

      const candidate: TrackPoint = {
        lat,
        lng,
        elevation,
        timestamp: new Date(),
        hr: currentHrRef.current !== null ? currentHrRef.current : undefined,
      };

      const prev = pointsRef.current;
      if (!shouldAcceptPoint(prev, candidate)) return;

      const next = [...prev, candidate];
      pointsRef.current = next;
      setPoints(next);
      recomputeStats(next, getElapsedSec());
    },
    [getElapsedSec, recomputeStats]
  );

  const startGpsWatch = useCallback(async () => {
    const stop = await startWatchingPosition(
      (pos) => addPoint(pos.lat, pos.lng, pos.elevation, pos.accuracy),
      (msg) => setError(msg)
    );
    stopWatchRef.current = stop;
  }, [addPoint]);

  const stopGpsWatch = useCallback(() => {
    stopWatchRef.current?.();
    stopWatchRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    const ok = await requestLocationPermission();
    if (!ok) {
      setError(
        "Permissão de localização negada. Ative o GPS nas configurações do app."
      );
      return false;
    }

    const initial = await getCurrentPosition();
    pointsRef.current = [];
    totalPausedMsRef.current = 0;
    pausedAtRef.current = null;
    startedAtRef.current = new Date();

    if (initial) {
      const p: TrackPoint = {
        lat: initial.lat,
        lng: initial.lng,
        elevation: initial.elevation,
        timestamp: initial.timestamp,
      };
      pointsRef.current = [p];
      setPoints([p]);
    } else {
      setPoints([]);
    }

    setStatus("recording");
    await startGpsWatch();
    recomputeStats(pointsRef.current, 0);
    return true;
  }, [recomputeStats, startGpsWatch]);

  const pause = useCallback(() => {
    if (status !== "recording") return;
    stopGpsWatch();
    pausedAtRef.current = new Date();
    setStatus("paused");
  }, [status, stopGpsWatch]);

  const resume = useCallback(async () => {
    if (status !== "paused" || !pausedAtRef.current) return;
    totalPausedMsRef.current +=
      Date.now() - pausedAtRef.current.getTime();
    pausedAtRef.current = null;
    setStatus("recording");
    await startGpsWatch();
  }, [status, startGpsWatch]);

  const stop = useCallback(async (): Promise<string | null> => {
    stopGpsWatch();
    setStatus("saving");

    const endedAt = new Date();
    const startedAt = startedAtRef.current ?? endedAt;
    const elapsedSec = getElapsedSec();
    const pts = pointsRef.current;

    const validationError = validateRecordedWorkout(pts, elapsedSec);
    if (validationError) {
      setStatus("idle");
      setError(validationError);
      return null;
    }

    try {
      const parsed = buildRecordedActivity(sport, startedAt, endedAt, pts);
      parsed.durationSec = elapsedSec;
      const id = await saveActivity(parsed, "recorded");
      setStatus("idle");
      pointsRef.current = [];
      setPoints([]);
      startedAtRef.current = null;
      return id;
    } catch (e) {
      setStatus("idle");
      setError(e instanceof Error ? e.message : "Erro ao salvar treino");
      return null;
    }
  }, [getElapsedSec, sport, stopGpsWatch]);

  const reset = useCallback(() => {
    stopGpsWatch();
    setStatus("idle");
    setPoints([]);
    pointsRef.current = [];
    startedAtRef.current = null;
    setError(null);
    setStats({
      elapsedSec: 0,
      distanceM: 0,
      currentPaceSecKm: null,
      avgPaceSecKm: null,
    });
  }, [stopGpsWatch]);

  const connectHr = useCallback(async () => {
    if (typeof window === "undefined") return;

    setHrStatus("connecting");
    setError(null);

    try {
      await BleClient.initialize();

      if (Capacitor.isNativePlatform()) {
        const enabled = await BleClient.isEnabled();
        if (!enabled) {
          try {
            await BleClient.requestEnable();
          } catch (e) {
            throw new Error("Por favor, ative o Bluetooth do aparelho.");
          }
        }
      }

      const device = await BleClient.requestDevice({
        services: [HEART_RATE_SERVICE],
      });

      const deviceId = device.deviceId;
      hrDeviceIdRef.current = deviceId;
      setHrDeviceName(device.name || "Sensor de FC");

      const onDisconnected = (disconnectedId: string) => {
        if (hrDeviceIdRef.current === disconnectedId) {
          setHrStatus("disconnected");
          setHrBpm(null);
          setHrDeviceName(null);
          currentHrRef.current = null;
          hrDeviceIdRef.current = null;
        }
      };

      await BleClient.connect(deviceId, onDisconnected);

      await BleClient.startNotifications(
        deviceId,
        HEART_RATE_SERVICE,
        HEART_RATE_MEASUREMENT_CHARACTERISTIC,
        (value: DataView) => {
          if (!value) return;

          const flags = value.getUint8(0);
          const rate16Bits = flags & 0x01;
          let heartRate: number;

          if (rate16Bits) {
            heartRate = value.getUint16(1, true);
          } else {
            heartRate = value.getUint8(1);
          }

          setHrBpm(heartRate);
          currentHrRef.current = heartRate;
        }
      );

      setHrStatus("connected");
    } catch (err: any) {
      setHrStatus("disconnected");
      setHrBpm(null);
      setHrDeviceName(null);
      currentHrRef.current = null;
      hrDeviceIdRef.current = null;

      if (
        err.name === "NotFoundError" ||
        err.message?.includes("User cancelled") ||
        err.message?.includes("cancelled")
      ) {
        return;
      }

      setError(err instanceof Error ? err.message : "Erro ao conectar sensor de FC.");
    }
  }, []);

  const disconnectHr = useCallback(async () => {
    const deviceId = hrDeviceIdRef.current;
    if (deviceId) {
      try {
        await BleClient.stopNotifications(
          deviceId,
          HEART_RATE_SERVICE,
          HEART_RATE_MEASUREMENT_CHARACTERISTIC
        );
      } catch (err) {
        console.error("Error stopping notifications:", err);
      }
      try {
        await BleClient.disconnect(deviceId);
      } catch (err) {
        console.error("Error disconnecting GATT:", err);
      }
    }
    setHrStatus("disconnected");
    setHrBpm(null);
    setHrDeviceName(null);
    currentHrRef.current = null;
    hrDeviceIdRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopGpsWatch();
      const deviceId = hrDeviceIdRef.current;
      if (deviceId) {
        BleClient.disconnect(deviceId).catch((err) => {
          console.error("Cleanup error disconnecting GATT:", err);
        });
      }
    };
  }, [stopGpsWatch]);


  return {
    status,
    sport,
    setSport,
    points,
    stats,
    error,
    setError,
    start,
    pause,
    resume,
    stop,
    reset,
    isActive: status === "recording" || status === "paused",
    hrStatus,
    hrBpm,
    hrDeviceName,
    hrSupported,
    connectHr,
    disconnectHr,
  };
}
