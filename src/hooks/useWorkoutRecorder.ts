"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveActivity, getActivity } from "@/lib/activities";
import { distanceFromPoints, haversineM } from "@/lib/geo";
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
import type { Sport, TrackPoint, GhostConfig, GhostStats, VoiceCoachConfig, AutoPauseConfig } from "@/lib/types";
import { isOnRoute, pointToPolylineDistanceM } from "@/lib/route-geo";
import type { RouteConfig, OffRouteState, SavedRoute } from "@/lib/types";
import { getStoredRoute } from "@/lib/storage";
import { BleClient } from "@capacitor-community/bluetooth-le";
import { Capacitor } from "@capacitor/core";
import { useI18n } from "@/lib/i18n";
import {
  DEFAULT_VOICE_COACH_CONFIG,
  buildVoiceCoachAnnouncement,
  speakWithConfig,
  type VoiceCoachStats,
} from "@/lib/voice-coach";
import {
  DEFAULT_AUTO_PAUSE_CONFIG,
  computeInstantSpeedKmh,
  playAutoPauseSound,
} from "@/lib/auto-pause";
import { getUserProfile, saveUserProfile } from "@/lib/profile";
import { calculateHrZones, getCurrentHrZone } from "@/lib/hr-zones";

const HEART_RATE_SERVICE = "0000180d-0000-1000-8000-00805f9b34fb";
const HEART_RATE_MEASUREMENT_CHARACTERISTIC = "00002a37-0000-1000-8000-00805f9b34fb";


export type RecorderStatus = "idle" | "recording" | "paused" | "saving";

export interface RecorderStats {
  elapsedSec: number;
  movingSec: number;
  distanceM: number;
  currentPaceSecKm: number | null;
  avgPaceSecKm: number | null;
  isAutoPaused: boolean;
}

export function useWorkoutRecorder() {
  const { t, language } = useI18n();

  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [sport, setSport] = useState<Sport>("running");
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [stats, setStats] = useState<RecorderStats>({
    elapsedSec: 0,
    movingSec: 0,
    distanceM: 0,
    currentPaceSecKm: null,
    avgPaceSecKm: null,
    isAutoPaused: false,
  });
  const [error, setError] = useState<string | null>(null);

  // Ghost Runner States
  const [ghostConfig, setGhostConfig] = useState<GhostConfig | null>(null);
  const [ghostStats, setGhostStats] = useState<GhostStats | null>(null);
  const [routeConfig, setRouteConfigState] = useState<RouteConfig | null>(null);
  const [offRouteState, setOffRouteState] = useState<OffRouteState | null>(null);
  const [routePoints, setRoutePoints] = useState<{lat: number; lng: number}[]>([]);

  // Bluetooth HR States
  const [hrStatus, setHrStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [hrBpm, setHrBpm] = useState<number | null>(null);
  const [hrDeviceName, setHrDeviceName] = useState<string | null>(null);
  const [hrSupported, setHrSupported] = useState<boolean>(false);

  // Voice Coach States & Refs
  const [voiceCoachConfig, setVoiceCoachConfigState] = useState<VoiceCoachConfig>(DEFAULT_VOICE_COACH_CONFIG);
  const voiceCoachConfigRef = useRef<VoiceCoachConfig>(DEFAULT_VOICE_COACH_CONFIG);
  const userProfileRef = useRef<any>(null);
  const userHrZonesRef = useRef<any[]>([]);

  // Auto-Pause States & Refs (Feature 21)
  const [autoPauseConfig, setAutoPauseConfigState] = useState<AutoPauseConfig>(DEFAULT_AUTO_PAUSE_CONFIG);
  const autoPauseConfigRef = useRef<AutoPauseConfig>(DEFAULT_AUTO_PAUSE_CONFIG);
  const [isAutoPaused, setIsAutoPaused] = useState<boolean>(false);
  const isAutoPausedRef = useRef<boolean>(false);
  const lowSpeedCountRef = useRef<number>(0);
  const movingSecRef = useRef<number>(0);

  const lastVoiceCoachDistMilestoneRef = useRef<number>(0);
  const lastVoiceCoachTimeMilestoneRef = useRef<number>(0);
  const lastCompletedKmRef = useRef<number>(0);
  const kmStartTimeSecRef = useRef<number>(0);
  const latestKmSplitRef = useRef<{ km: number; paceSecKm: number } | null>(null);

  const startedAtRef = useRef<Date | null>(null);
  const pausedAtRef = useRef<Date | null>(null);
  const totalPausedMsRef = useRef(0);
  const pointsRef = useRef<TrackPoint[]>([]);
  const stopWatchRef = useRef<(() => void) | null>(null);
  const lastPaceRef = useRef<{ dist: number; time: number } | null>(null);
  const distanceMRef = useRef(0);

  // Bluetooth HR Refs
  const currentHrRef = useRef<number | null>(null);
  const hrDeviceIdRef = useRef<string | null>(null);

  // Status and Config refs to avoid re-triggering hooks/callbacks unnecessarily
  const statusRef = useRef<RecorderStatus>("idle");
  const ghostConfigRef = useRef<GhostConfig | null>(null);

  // Ghost Runner Refs
  const lastSpokenKmRef = useRef<number>(0);
  const lastSpokenMinRef = useRef<number>(0);
  const ghostRefPointsRef = useRef<{ elapsedSec: number; cumDistanceM: number }[]>([]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    ghostConfigRef.current = ghostConfig;
  }, [ghostConfig]);

  useEffect(() => {
    voiceCoachConfigRef.current = voiceCoachConfig;
  }, [voiceCoachConfig]);

  useEffect(() => {
    autoPauseConfigRef.current = autoPauseConfig;
  }, [autoPauseConfig]);

  // Load Voice Coach & Auto Pause preferences and user profile on mount
  useEffect(() => {
    async function loadUserPreferences() {
      try {
        const profile = await getUserProfile();
        userProfileRef.current = profile;
        if (profile) {
          userHrZonesRef.current = calculateHrZones(profile);
          if (profile.voiceCoach) {
            setVoiceCoachConfigState(profile.voiceCoach);
            voiceCoachConfigRef.current = profile.voiceCoach;
          }
          if (profile.autoPause) {
            setAutoPauseConfigState(profile.autoPause);
            autoPauseConfigRef.current = profile.autoPause;
          }
        }
      } catch (e) {
        console.error("Erro ao carregar preferências:", e);
      }
    }
    loadUserPreferences();
  }, []);

  const updateVoiceCoachConfig = useCallback(async (newConfig: VoiceCoachConfig) => {
    setVoiceCoachConfigState(newConfig);
    voiceCoachConfigRef.current = newConfig;
    try {
      const profile = await getUserProfile();
      await saveUserProfile({
        ...(profile || {}),
        voiceCoach: newConfig,
      });
    } catch (e) {
      console.error("Erro ao persistir preferências do Voice Coach:", e);
    }
  }, []);

  const updateAutoPauseConfig = useCallback(async (newConfig: AutoPauseConfig) => {
    setAutoPauseConfigState(newConfig);
    autoPauseConfigRef.current = newConfig;
    try {
      const profile = await getUserProfile();
      await saveUserProfile({
        ...(profile || {}),
        autoPause: newConfig,
      });
    } catch (e) {
      console.error("Erro ao persistir preferências de Auto-Pause:", e);
    }
  }, []);
  const setRouteConfig = useCallback(async (config: RouteConfig | null) => {
    setRouteConfigState(config);
    if (config?.routeId) {
      const route = await getStoredRoute(config.routeId);
      setRoutePoints(route?.points || []);
      setOffRouteState({
        isOffRoute: false,
        distanceFromRouteM: 0,
        nearestPoint: null,
        estimatedDistanceM: 0,
        totalRouteDistanceM: route?.distanceM || 0,
      });
    } else {
      setRoutePoints([]);
      setOffRouteState(null);
    }
  }, []);

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


  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === "pt" ? "pt-BR" : "en-US";
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("TTS failed:", e);
    }
  }, [language]);

  const recomputeStats = useCallback((pts: TrackPoint[], elapsedSec: number, movingSec?: number, isAutoPausedNow?: boolean) => {
    const distanceM = distanceMRef.current;
    const effectiveMovingSec = movingSec != null ? movingSec : (movingSecRef.current > 0 ? movingSecRef.current : elapsedSec);
    let avgPaceSecKm: number | null = null;
    if (distanceM > 0 && effectiveMovingSec > 0) {
      avgPaceSecKm = (effectiveMovingSec / distanceM) * 1000;
    }

    let currentPaceSecKm: number | null = null;
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    if (last?.timestamp && prev?.timestamp) {
      const segDist = haversineM(prev.lat, prev.lng, last.lat, last.lng);
      const segTime =
        (last.timestamp.getTime() - prev.timestamp.getTime()) / 1000;
      if (segDist > 0 && segTime > 0) {
        currentPaceSecKm = (segTime / segDist) * 1000;
      }
    }

    setStats({
      elapsedSec,
      movingSec: effectiveMovingSec,
      distanceM,
      currentPaceSecKm,
      avgPaceSecKm,
      isAutoPaused: isAutoPausedNow ?? isAutoPausedRef.current,
    });

    const activeConfig = ghostConfigRef.current;
    if (activeConfig && activeConfig.mode !== "disabled") {
      let ghostDistance = 0;
      if (activeConfig.mode === "pace" && activeConfig.targetPaceSecKm) {
        const speedMps = 1000 / activeConfig.targetPaceSecKm;
        ghostDistance = elapsedSec * speedMps;
      } else if (activeConfig.mode === "activity" && ghostRefPointsRef.current.length > 0) {
        const refPts = ghostRefPointsRef.current;
        if (elapsedSec >= refPts[refPts.length - 1].elapsedSec) {
          ghostDistance = refPts[refPts.length - 1].cumDistanceM;
        } else {
          let idx = 0;
          for (let i = 0; i < refPts.length - 1; i++) {
            if (refPts[i].elapsedSec <= elapsedSec && refPts[i + 1].elapsedSec > elapsedSec) {
              idx = i;
              break;
            }
          }
          const p1 = refPts[idx];
          const p2 = refPts[idx + 1];
          const segDuration = p2.elapsedSec - p1.elapsedSec;
          const ratio = segDuration > 0 ? (elapsedSec - p1.elapsedSec) / segDuration : 0;
          ghostDistance = p1.cumDistanceM + ratio * (p2.cumDistanceM - p1.cumDistanceM);
        }
      }

      const diffM = distanceM - ghostDistance;
      let statusVal: "ahead" | "behind" | "tied" = "tied";
      if (diffM > 0.5) statusVal = "ahead";
      else if (diffM < -0.5) statusVal = "behind";

      setGhostStats({
        distanceM: ghostDistance,
        diffM,
        status: statusVal,
      });

      // TTS voice alerts
      if (activeConfig.audioAlerts && statusRef.current === "recording") {
        let shouldSpeak = false;
        if (activeConfig.audioFreq === "1km") {
          const currKm = Math.floor(distanceM / 1000);
          if (currKm > lastSpokenKmRef.current) {
            shouldSpeak = true;
            lastSpokenKmRef.current = currKm;
          }
        } else if (activeConfig.audioFreq === "2min") {
          const currMin = Math.floor(elapsedSec / 120);
          if (currMin > lastSpokenMinRef.current) {
            shouldSpeak = true;
            lastSpokenMinRef.current = currMin;
          }
        } else if (activeConfig.audioFreq === "5min") {
          const currMin = Math.floor(elapsedSec / 300);
          if (currMin > lastSpokenMinRef.current) {
            shouldSpeak = true;
            lastSpokenMinRef.current = currMin;
          }
        }

        if (shouldSpeak) {
          const diffAbs = Math.round(Math.abs(diffM));
          let msg = "";
          if (statusVal === "ahead") {
            msg = t("record.ghost_audio_alert_ahead", { diff: diffAbs });
          } else if (statusVal === "behind") {
            msg = t("record.ghost_audio_alert_behind", { diff: diffAbs });
          } else {
            msg = t("record.ghost_audio_alert_tied");
          }
          speak(msg);
        }
      }
    } else {
      setGhostStats(null);
    }

    // Split KM Calculation
    const currentKm = Math.floor(distanceM / 1000);
    if (currentKm > lastCompletedKmRef.current && currentKm > 0) {
      const kmDuration = elapsedSec - kmStartTimeSecRef.current;
      if (kmDuration > 0) {
        latestKmSplitRef.current = { km: currentKm, paceSecKm: kmDuration };
      }
      kmStartTimeSecRef.current = elapsedSec;
      lastCompletedKmRef.current = currentKm;
    }

    // Voice Coach Periodic Announcements (Feature 20)
    const vConfig = voiceCoachConfigRef.current;
    if (vConfig && vConfig.enabled && statusRef.current === "recording") {
      let shouldTriggerVoice = false;
      if (vConfig.triggerType === "distance") {
        const interval = vConfig.distanceIntervalM || 1000;
        const milestone = Math.floor(distanceM / interval);
        if (milestone > lastVoiceCoachDistMilestoneRef.current && milestone > 0) {
          shouldTriggerVoice = true;
          lastVoiceCoachDistMilestoneRef.current = milestone;
        }
      } else if (vConfig.triggerType === "time") {
        const interval = vConfig.timeIntervalSec || 300;
        const milestone = Math.floor(elapsedSec / interval);
        if (milestone > lastVoiceCoachTimeMilestoneRef.current && milestone > 0) {
          shouldTriggerVoice = true;
          lastVoiceCoachTimeMilestoneRef.current = milestone;
        }
      }

      if (shouldTriggerVoice) {
        let hrZoneName: string | null = null;
        if (currentHrRef.current && userHrZonesRef.current.length > 0) {
          const zone = getCurrentHrZone(currentHrRef.current, userHrZonesRef.current);
          if (zone) {
            hrZoneName = t(zone.nameKey);
          }
        }

        const coachStats: VoiceCoachStats = {
          distanceM,
          elapsedSec,
          avgPaceSecKm,
          currentPaceSecKm,
          heartRate: currentHrRef.current,
          heartRateZoneName: hrZoneName,
          lastSplitKm: latestKmSplitRef.current?.km,
          lastSplitPaceSecKm: latestKmSplitRef.current?.paceSecKm,
        };

        const msg = buildVoiceCoachAnnouncement(coachStats, vConfig, language);
        if (msg) {
          speakWithConfig(msg, vConfig, language);
        }
      }
    }
  }, [speak, t, language]);

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
      const elapsed = getElapsedSec();
      const apConfig = autoPauseConfigRef.current;

      if (apConfig && apConfig.enabled && pointsRef.current.length >= 2) {
        const speedKmh = computeInstantSpeedKmh(pointsRef.current, 3);
        const minSpeed = apConfig.minSpeedKmh || 1.5;
        const delay = apConfig.pauseDelaySec || 3;

        if (speedKmh < minSpeed) {
          lowSpeedCountRef.current += 1;
          if (lowSpeedCountRef.current >= delay && !isAutoPausedRef.current) {
            isAutoPausedRef.current = true;
            setIsAutoPaused(true);
            if (apConfig.audioFeedback) {
              playAutoPauseSound(true, language);
            }
          }
        } else {
          lowSpeedCountRef.current = 0;
          if (isAutoPausedRef.current) {
            isAutoPausedRef.current = false;
            setIsAutoPaused(false);
            if (apConfig.audioFeedback) {
              playAutoPauseSound(false, language);
            }
          }
        }
      } else {
        isAutoPausedRef.current = false;
        setIsAutoPaused(false);
      }

      if (!isAutoPausedRef.current) {
        movingSecRef.current += 1;
      }

      recomputeStats(pointsRef.current, elapsed, movingSecRef.current, isAutoPausedRef.current);
    }, 1000);
    return () => clearInterval(tick);
  }, [status, recomputeStats, getElapsedSec, language]);

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

      const lastPoint = prev[prev.length - 1];
      if (lastPoint) {
        const segDist = haversineM(lastPoint.lat, lastPoint.lng, candidate.lat, candidate.lng);
        distanceMRef.current += segDist;
      }

      const next = [...prev, candidate];
      pointsRef.current = next;
      setPoints(next);
      recomputeStats(next, getElapsedSec());
      // Off-route check
      if (routeConfig && routePoints.length > 0 && statusRef.current === "recording") {
        const lastPoint = pointsRef.current[pointsRef.current.length - 1];
        if (lastPoint) {
          const onRoute = isOnRoute(lastPoint, routePoints, routeConfig.offRouteToleranceM);
          const proximity = pointToPolylineDistanceM(lastPoint, routePoints);
          setOffRouteState({
            isOffRoute: !onRoute,
            distanceFromRouteM: proximity.distanceM,
            nearestPoint: proximity.snappedPoint,
            estimatedDistanceM: 0, // TODO: calculate cumulative distance along route
            totalRouteDistanceM: 0,
          });
        }
      }
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

  const start = useCallback(async (gConfig?: GhostConfig) => {
    setError(null);
    const ok = await requestLocationPermission();
    if (!ok) {
      setError(
        "Permissão de localização negada. Ative o GPS nas configurações do app."
      );
      return false;
    }

    // Reset Ghost Runner TTS trackers
    lastSpokenKmRef.current = 0;
    lastSpokenMinRef.current = 0;
    ghostRefPointsRef.current = [];

    // Reset Voice Coach trackers
    lastVoiceCoachDistMilestoneRef.current = 0;
    lastVoiceCoachTimeMilestoneRef.current = 0;
    lastCompletedKmRef.current = 0;
    kmStartTimeSecRef.current = 0;
    latestKmSplitRef.current = null;

    // Load past activity points if Ghost mode is activity
    if (gConfig && gConfig.mode === "activity" && gConfig.activityId) {
      try {
        const act = await getActivity(gConfig.activityId);
        if (act && act.points && act.points.length > 0) {
          const refPts = act.points;
          const validPts = refPts.filter((p) => p.timestamp);
          if (validPts.length > 0) {
            const startT = new Date(validPts[0].timestamp!).getTime();
            let cumD = 0;
            const mappedRefPts = [{ elapsedSec: 0, cumDistanceM: 0 }];
            for (let i = 1; i < validPts.length; i++) {
              const p1 = validPts[i - 1];
              const p2 = validPts[i];
              const d = haversineM(p1.lat, p1.lng, p2.lat, p2.lng);
              cumD += d;
              const elapsed = (new Date(p2.timestamp!).getTime() - startT) / 1000;
              mappedRefPts.push({ elapsedSec: elapsed, cumDistanceM: cumD });
            }
            ghostRefPointsRef.current = mappedRefPts;
          }
        }
      } catch (e) {
        console.error("Error loading ghost runner activity reference:", e);
      }
    }

    // Reset Auto-Pause trackers
    movingSecRef.current = 0;
    lowSpeedCountRef.current = 0;
    isAutoPausedRef.current = false;
    setIsAutoPaused(false);

    const initial = await getCurrentPosition();
    pointsRef.current = [];
    distanceMRef.current = 0;
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

    const activeConfig = gConfig || { mode: "disabled", audioAlerts: false, audioFreq: "1km" };
    setGhostConfig(activeConfig);
    ghostConfigRef.current = activeConfig;
    setGhostStats(activeConfig.mode !== "disabled" ? { distanceM: 0, diffM: 0, status: "tied" } : null);

    setStatus("recording");
    await startGpsWatch();
    recomputeStats(pointsRef.current, 0, 0, false);
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
      const parsed = buildRecordedActivity(sport, startedAt, endedAt, pts, movingSecRef.current);
      parsed.durationSec = elapsedSec;
      parsed.movingTimeSec = movingSecRef.current > 0 ? movingSecRef.current : elapsedSec;
      parsed.elapsedTimeSec = elapsedSec;
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
    distanceMRef.current = 0;
    startedAtRef.current = null;
    setError(null);
    setStats({
      elapsedSec: 0,
      movingSec: 0,
      distanceM: 0,
      currentPaceSecKm: null,
      avgPaceSecKm: null,
      isAutoPaused: false,
    });
    setGhostConfig(null);
    ghostConfigRef.current = null;
    setGhostStats(null);
    lastSpokenKmRef.current = 0;
    lastSpokenMinRef.current = 0;
    ghostRefPointsRef.current = [];
    lastVoiceCoachDistMilestoneRef.current = 0;
    lastVoiceCoachTimeMilestoneRef.current = 0;
    lastCompletedKmRef.current = 0;
    kmStartTimeSecRef.current = 0;
    latestKmSplitRef.current = null;
    movingSecRef.current = 0;
    lowSpeedCountRef.current = 0;
    isAutoPausedRef.current = false;
    setIsAutoPaused(false);
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
  // Off-route audio alert
  useEffect(() => {
    if (offRouteState?.isOffRoute && routeConfig?.audioAlerts && "speechSynthesis" in window) {
      const dist = Math.round(offRouteState.distanceFromRouteM);
      const utterance = new SpeechSynthesisUtterance(
        t("navigation.off_route_alert", { dist })
      );
      utterance.lang = language === "pt" ? "pt-BR" : "en-US";
      window.speechSynthesis.speak(utterance);
    }
  }, [offRouteState?.isOffRoute, routeConfig?.audioAlerts]);


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
    ghostConfig,
    ghostStats,
    routeConfig,
    setRouteConfig,
    offRouteState,
    voiceCoachConfig,
    updateVoiceCoachConfig,
    autoPauseConfig,
    updateAutoPauseConfig,
    isAutoPaused,
  };
}
