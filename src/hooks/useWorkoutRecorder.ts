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

  const startedAtRef = useRef<Date | null>(null);
  const pausedAtRef = useRef<Date | null>(null);
  const totalPausedMsRef = useRef(0);
  const pointsRef = useRef<TrackPoint[]>([]);
  const stopWatchRef = useRef<(() => void) | null>(null);
  const lastPaceRef = useRef<{ dist: number; time: number } | null>(null);

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

  useEffect(() => {
    return () => stopGpsWatch();
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
  };
}
