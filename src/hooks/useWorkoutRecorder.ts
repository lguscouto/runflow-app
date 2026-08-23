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
import type {
  Sport,
  TrackPoint,
  GhostConfig,
  GhostStats,
  VoiceCoachConfig,
  AutoPauseConfig,
  StructuredWorkout,
  FlatWorkoutStep,
  ExecutedStepReport,
  StructuredWorkoutReport,
  ManualLap,
} from "@/lib/types";
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
  getDefaultAutoPauseSpeed,
} from "@/lib/auto-pause";
import {
  calculateCyclingPower,
  computeInstantGradePercent,
  calculateVamMh,
} from "@/lib/cycling-physics";
import {
  CSCParser,
  CyclingPowerParser,
  CSC_SERVICE,
  CSC_MEASUREMENT_CHAR,
  POWER_SERVICE,
  POWER_MEASUREMENT_CHAR,
} from "@/lib/ble-cycling-parsers";
import type { BikeType } from "@/lib/types";
import { getAllStoredGear } from "@/lib/storage";
import { getUserProfile, saveUserProfile } from "@/lib/profile";
import { calculateHrZones, getCurrentHrZone } from "@/lib/hr-zones";
import { flattenWorkoutItems, evaluateStepTargetMet } from "@/lib/structured-workout";
import type { ClimbCategory, ClimbSegment, ClimbProgressState, RoutePoint } from "@/lib/types";
import { detectClimbs, getClimbProgress } from "@/lib/climb-detection";
import {
  buildClimbApproachAnnouncement,
  buildClimbStartAnnouncement,
  buildClimbCompletedAnnouncement,
} from "@/lib/voice-coach";
import { haptics } from "@/lib/haptics";
import {
  playCountdownPip,
  speakWorkoutStep,
  playStartBlockChime,
} from "@/lib/workout-audio";

const HEART_RATE_SERVICE = "0000180d-0000-1000-8000-00805f9b34fb";
const HEART_RATE_MEASUREMENT_CHARACTERISTIC = "00002a37-0000-1000-8000-00805f9b34fb";

export type RecorderStatus = "idle" | "recording" | "paused" | "saving";

export interface RecorderStats {
  elapsedSec: number;
  movingSec: number;
  distanceM: number;
  currentPaceSecKm: number | null;
  avgPaceSecKm: number | null;
  currentSpeedKmh: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  currentWatts: number;
  avgWatts: number;
  currentCadenceRpm: number | null;
  avgCadenceRpm: number;
  currentGradePercent: number;
  currentVamMh: number;
  isAutoPaused: boolean;
  powerSource: "sensor" | "estimated";
  climbProgress?: ClimbProgressState | null;
}

export function useWorkoutRecorder() {
  const { t, language } = useI18n();

  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [sport, setSportState] = useState<Sport>("running");
  const sportRef = useRef<Sport>("running");

  const setSport = useCallback((s: Sport) => {
    setSportState(s);
    sportRef.current = s;
  }, []);

  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [stats, setStats] = useState<RecorderStats>({
    elapsedSec: 0,
    movingSec: 0,
    distanceM: 0,
    currentPaceSecKm: null,
    avgPaceSecKm: null,
    currentSpeedKmh: 0,
    avgSpeedKmh: 0,
    maxSpeedKmh: 0,
    currentWatts: 0,
    avgWatts: 0,
    currentCadenceRpm: null,
    avgCadenceRpm: 0,
    currentGradePercent: 0,
    currentVamMh: 0,
    isAutoPaused: false,
    powerSource: "estimated" as const,
  });
  const [error, setError] = useState<string | null>(null);

  // Ghost Runner States
  const [ghostConfig, setGhostConfig] = useState<GhostConfig | null>(null);
  const [ghostStats, setGhostStats] = useState<GhostStats | null>(null);
  const [routeConfig, setRouteConfigState] = useState<RouteConfig | null>(null);
  const [offRouteState, setOffRouteState] = useState<OffRouteState | null>(null);
  const [routePoints, setRoutePoints] = useState<{ lat: number; lng: number; elevation?: number }[]>([]);

  // ClimbPro States (Etapa 6)
  const [detectedClimbs, setDetectedClimbs] = useState<ClimbSegment[]>([]);
  const detectedClimbsRef = useRef<ClimbSegment[]>([]);
  const [climbProgressState, setClimbProgressState] = useState<ClimbProgressState | null>(null);
  const climbProgressRef = useRef<ClimbProgressState | null>(null);
  const lastApproachedClimbIdRef = useRef<string | null>(null);
  const lastStartedClimbIdRef = useRef<string | null>(null);
  const lastCompletedClimbIdRef = useRef<string | null>(null);
  const wasInClimbRef = useRef<boolean>(false);
  const activeClimbRef = useRef<ClimbSegment | null>(null);

  // Bluetooth HR States
  const [hrStatus, setHrStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [hrBpm, setHrBpm] = useState<number | null>(null);
  const [hrDeviceName, setHrDeviceName] = useState<string | null>(null);
  const [hrSupported, setHrSupported] = useState<boolean>(false);

  // Bluetooth Cadence (CSC) States
  const [cscStatus, setCscStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [cscCadenceRpm, setCscCadenceRpm] = useState<number | null>(null);
  const [cscDeviceName, setCscDeviceName] = useState<string | null>(null);

  // Bluetooth Power Meter States
  const [powerStatus, setPowerStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [powerWatts, setPowerWatts] = useState<number | null>(null);
  const [powerDeviceName, setPowerDeviceName] = useState<string | null>(null);
  const [powerCadenceRpm, setPowerCadenceRpm] = useState<number | null>(null);

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

  // Structured Workout States & Refs (Feature 23)
  const [structuredWorkout, setStructuredWorkoutState] = useState<StructuredWorkout | null>(null);
  const structuredWorkoutRef = useRef<StructuredWorkout | null>(null);
  const [flatSteps, setFlatSteps] = useState<FlatWorkoutStep[]>([]);
  const flatStepsRef = useRef<FlatWorkoutStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const currentStepIndexRef = useRef<number>(0);
  const [stepElapsedSec, setStepElapsedSec] = useState<number>(0);
  const [stepDistanceM, setStepDistanceM] = useState<number>(0);
  const stepStartTimeSecRef = useRef<number>(0);
  const stepStartDistanceMRef = useRef<number>(0);
  const executedStepsReportRef = useRef<ExecutedStepReport[]>([]);
  const lastPipSecRef = useRef<number | null>(null);

  const lastVoiceCoachDistMilestoneRef = useRef<number>(0);
  const lastVoiceCoachTimeMilestoneRef = useRef<number>(0);
  const lastCompletedKmRef = useRef<number>(0);
  const kmStartTimeSecRef = useRef<number>(0);
  const latestKmSplitRef = useRef<{ km: number; paceSecKm: number; speedKmh?: number } | null>(null);

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

  // Bluetooth CSC Refs
  const currentCadenceRef = useRef<number | null>(null);
  const cscDeviceIdRef = useRef<string | null>(null);
  const cscParserRef = useRef(new CSCParser());
  const accumulatedCadenceRef = useRef<number[]>([]);

  // Bluetooth Power Meter Refs
  const currentPowerRef = useRef<number | null>(null);
  const powerDeviceIdRef = useRef<string | null>(null);
  const powerParserRef = useRef(new CyclingPowerParser());
  const powerCadenceRef = useRef<number | null>(null);

  // Status and Config refs
  const statusRef = useRef<RecorderStatus>("idle");
  const ghostConfigRef = useRef<GhostConfig | null>(null);

  // Ghost Runner Refs
  const lastSpokenKmRef = useRef<number>(0);
  const lastSpokenMinRef = useRef<number>(0);
  const ghostRefPointsRef = useRef<{ elapsedSec: number; cumDistanceM: number }[]>([]);

  // Cycling Physics Refs
  const riderWeightRef = useRef<number>(75);
  const bikeWeightRef = useRef<number>(9.0);
  const bikeTypeRef = useRef<BikeType>("road");
  const maxSpeedKmhRef = useRef<number>(0);
  const totalElevationGainRef = useRef<number>(0);
  const accumulatedWattsRef = useRef<number[]>([]);

  // Manual Laps (Feature 28)
  const [manualLaps, setManualLaps] = useState<ManualLap[]>([]);
  const manualLapsRef = useRef<ManualLap[]>([]);
  const lapStartSecRef = useRef<number>(0);
  const lapStartDistMRef = useRef<number>(0);
  const lapNumberRef = useRef<number>(1);
  const [currentLapNumber, setCurrentLapNumber] = useState<number>(1);
  const [lastCompletedLap, setLastCompletedLap] = useState<ManualLap | null>(null);

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

  useEffect(() => {
    structuredWorkoutRef.current = structuredWorkout;
  }, [structuredWorkout]);

  // Load Voice Coach & Auto Pause preferences on mount
  useEffect(() => {
    async function loadUserPreferences() {
      try {
        const profile = await getUserProfile();
        userProfileRef.current = profile;
        if (profile) {
          if (profile.weightKg) {
            riderWeightRef.current = profile.weightKg;
          }
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

        const gears = await getAllStoredGear();
        const defaultBike =
          gears.find((g) => g.type === "bike" && g.isDefaultCycling && g.status === "active") ||
          gears.find((g) => g.type === "bike" && g.status === "active");
        if (defaultBike) {
          if (defaultBike.weightKg) bikeWeightRef.current = defaultBike.weightKg;
          if (defaultBike.bikeType) bikeTypeRef.current = defaultBike.bikeType;
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
      const pts = route?.points || [];
      setRoutePoints(pts);
      const climbs = detectClimbs(pts);
      setDetectedClimbs(climbs);
      detectedClimbsRef.current = climbs;
      lastApproachedClimbIdRef.current = null;
      lastStartedClimbIdRef.current = null;
      lastCompletedClimbIdRef.current = null;
      wasInClimbRef.current = false;
      activeClimbRef.current = null;

      setOffRouteState({
        isOffRoute: false,
        distanceFromRouteM: 0,
        nearestPoint: null,
        estimatedDistanceM: 0,
        totalRouteDistanceM: route?.distanceM || 0,
      });
    } else {
      setRoutePoints([]);
      setDetectedClimbs([]);
      detectedClimbsRef.current = [];
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

  /**
   * Avança para a próxima etapa do treino estruturado e armazena parciais.
   */
  const advanceStructuredWorkoutStep = useCallback(
    (nowElapsedSec: number, nowDistanceM: number) => {
      const steps = flatStepsRef.current;
      const currIdx = currentStepIndexRef.current;
      if (!steps || steps.length === 0 || currIdx >= steps.length) return;

      const currentFlat = steps[currIdx];
      const durationSec = Math.max(1, Math.round(nowElapsedSec - stepStartTimeSecRef.current));
      const distanceM = Math.max(0, Math.round(nowDistanceM - stepStartDistanceMRef.current));
      const avgPaceSecKm = distanceM > 10 && durationSec > 0 ? (durationSec / distanceM) * 1000 : null;

      const targetMet = evaluateStepTargetMet(currentFlat.step, {
        durationSec,
        distanceM,
        avgPaceSecKm,
      });

      const executed: ExecutedStepReport = {
        stepIndex: currIdx,
        name: currentFlat.step.name || currentFlat.step.type,
        type: currentFlat.step.type,
        targetType: currentFlat.step.targetType,
        targetValue: currentFlat.step.targetValue,
        paceTarget: currentFlat.step.paceTarget,
        hrZoneTarget: currentFlat.step.hrZoneTarget,
        repeatIndex: currentFlat.repeatIndex,
        totalRepeats: currentFlat.totalRepeats,
        durationSec,
        distanceM,
        avgPaceSecKm,
        avgHr: currentHrRef.current,
        targetMet,
      };

      executedStepsReportRef.current.push(executed);

      const nextIdx = currIdx + 1;
      currentStepIndexRef.current = nextIdx;
      setCurrentStepIndex(nextIdx);
      stepStartTimeSecRef.current = nowElapsedSec;
      stepStartDistanceMRef.current = nowDistanceM;
      setStepElapsedSec(0);
      setStepDistanceM(0);
      lastPipSecRef.current = null;

      if (nextIdx < steps.length) {
        speakWorkoutStep(steps[nextIdx], voiceCoachConfigRef.current, language);
      } else {
        playStartBlockChime();
        speakWithConfig(
          language === "en" ? "Structured workout completed! Great job!" : "Treino intervalado concluído! Excelente trabalho!",
          voiceCoachConfigRef.current,
          language
        );
      }
    },
    [language]
  );

  const getElapsedSec = useCallback(() => {
    if (!startedAtRef.current) return 0;
    const now = Date.now();
    const end =
      status === "paused" && pausedAtRef.current
        ? pausedAtRef.current.getTime()
        : now;
    const raw = (end - startedAtRef.current.getTime()) / 1000;
    return Math.max(0, raw - totalPausedMsRef.current / 1000);
  }, [status]);

  const skipStructuredWorkoutStep = useCallback(() => {
    const elapsed = getElapsedSec();
    const dist = distanceMRef.current;
    advanceStructuredWorkoutStep(elapsed, dist);
  }, [getElapsedSec, advanceStructuredWorkoutStep]);

  const setStructuredWorkout = useCallback((workout: StructuredWorkout | null) => {
    setStructuredWorkoutState(workout);
    structuredWorkoutRef.current = workout;
    if (workout) {
      const flattened = flattenWorkoutItems(workout.items);
      setFlatSteps(flattened);
      flatStepsRef.current = flattened;
    } else {
      setFlatSteps([]);
      flatStepsRef.current = [];
    }
  }, []);

  const recomputeStats = useCallback(
    (pts: TrackPoint[], elapsedSec: number, movingSec?: number, isAutoPausedNow?: boolean) => {
      const distanceM = distanceMRef.current;
      const effectiveMovingSec =
        movingSec != null ? movingSec : movingSecRef.current > 0 ? movingSecRef.current : elapsedSec;
      let avgPaceSecKm: number | null = null;
      if (distanceM > 0 && effectiveMovingSec > 0) {
        avgPaceSecKm = (effectiveMovingSec / distanceM) * 1000;
      }

      let currentPaceSecKm: number | null = null;
      const last = pts[pts.length - 1];
      const prev = pts[pts.length - 2];
      if (last?.timestamp && prev?.timestamp) {
        const segDist = haversineM(prev.lat, prev.lng, last.lat, last.lng);
        const segTime = (last.timestamp.getTime() - prev.timestamp.getTime()) / 1000;
        if (segDist > 0 && segTime > 0) {
          currentPaceSecKm = (segTime / segDist) * 1000;
        }
      }

      // Speed & Cycling Metrics
      const instantSpeedKmh = computeInstantSpeedKmh(pts);
      if (instantSpeedKmh > maxSpeedKmhRef.current && instantSpeedKmh < 120) {
        maxSpeedKmhRef.current = instantSpeedKmh;
      }
      const avgSpeedKmh =
        distanceM > 0 && effectiveMovingSec > 0
          ? (distanceM / effectiveMovingSec) * 3.6
          : 0;

      // Elevation Gain & Grade %
      if (pts.length >= 2) {
        const lastP = pts[pts.length - 1];
        const prevP = pts[pts.length - 2];
        if (lastP.elevation != null && prevP.elevation != null) {
          const elevDelta = lastP.elevation - prevP.elevation;
          if (elevDelta > 0 && !isAutoPausedNow) {
            totalElevationGainRef.current += elevDelta;
          }
        }
      }
      const currentGradePercent = computeInstantGradePercent(pts, 30);

      // Potência: sensor BLE > estimativa física
      const estimatedWatts =
        sportRef.current === "cycling"
          ? calculateCyclingPower({
              speedMs: instantSpeedKmh / 3.6,
              gradePercent: currentGradePercent,
              riderMassKg: riderWeightRef.current,
              bikeMassKg: bikeWeightRef.current,
              bikeType: bikeTypeRef.current,
            }).totalWatts
          : 0;

      const hasPowerSensor = currentPowerRef.current !== null;
      const currentWatts = hasPowerSensor
        ? currentPowerRef.current!
        : estimatedWatts;
      const powerSource: "sensor" | "estimated" = hasPowerSensor ? "sensor" : "estimated";

      if (currentWatts > 0 && !isAutoPausedNow) {
        accumulatedWattsRef.current.push(currentWatts);
      }
      const avgWatts =
        accumulatedWattsRef.current.length > 0
          ? Math.round(
              accumulatedWattsRef.current.reduce((a, b) => a + b, 0) /
                accumulatedWattsRef.current.length
            )
          : 0;

      // Cadência: sensor CSC > cadência do Power Meter
      const currentCadenceRpm = currentCadenceRef.current ?? powerCadenceRef.current;
      if (currentCadenceRpm !== null && currentCadenceRpm > 0 && !isAutoPausedNow) {
        accumulatedCadenceRef.current.push(currentCadenceRpm);
      }
      const avgCadenceRpm =
        accumulatedCadenceRef.current.length > 0
          ? Math.round(
              accumulatedCadenceRef.current.reduce((a, b) => a + b, 0) /
                accumulatedCadenceRef.current.length
            )
          : 0;

      const currentVamMh = calculateVamMh(
        totalElevationGainRef.current,
        effectiveMovingSec
      );

      // ClimbPro Progress Tracking (Etapa 6)
      let currentClimbProg: ClimbProgressState | null = null;
      if (detectedClimbsRef.current.length > 0) {
        currentClimbProg = getClimbProgress(
          detectedClimbsRef.current,
          distanceM,
          currentGradePercent
        );
        setClimbProgressState(currentClimbProg);
        climbProgressRef.current = currentClimbProg;
      }

      setStats({
        elapsedSec,
        movingSec: effectiveMovingSec,
        distanceM,
        currentPaceSecKm,
        avgPaceSecKm,
        currentSpeedKmh: Number(instantSpeedKmh.toFixed(1)),
        avgSpeedKmh: Number(avgSpeedKmh.toFixed(1)),
        maxSpeedKmh: Number(maxSpeedKmhRef.current.toFixed(1)),
        currentWatts,
        avgWatts,
        currentCadenceRpm,
        avgCadenceRpm,
        currentGradePercent: Number(currentGradePercent.toFixed(1)),
        currentVamMh,
        isAutoPaused: isAutoPausedNow ?? isAutoPausedRef.current,
        powerSource,
        climbProgress: currentClimbProg,
      });

      // Structured Workout Step Progress & Completion Checks
      if (flatStepsRef.current.length > 0 && currentStepIndexRef.current < flatStepsRef.current.length) {
        const currentFlat = flatStepsRef.current[currentStepIndexRef.current];
        const curStepDist = Math.max(0, distanceM - stepStartDistanceMRef.current);
        const curStepTime = Math.max(0, elapsedSec - stepStartTimeSecRef.current);

        setStepDistanceM(curStepDist);
        setStepElapsedSec(curStepTime);

        if (statusRef.current === "recording") {
          if (currentFlat.step.targetType === "distance" && curStepDist >= currentFlat.step.targetValue) {
            advanceStructuredWorkoutStep(elapsedSec, distanceM);
          } else if (currentFlat.step.targetType === "time") {
            const rem = Math.ceil(currentFlat.step.targetValue - curStepTime);
            if (rem <= 3 && rem > 0 && lastPipSecRef.current !== rem) {
              lastPipSecRef.current = rem;
              playCountdownPip();
            }
            if (curStepTime >= currentFlat.step.targetValue) {
              advanceStructuredWorkoutStep(elapsedSec, distanceM);
            }
          }
        }
      }

      // Ghost Runner calculations
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

        // TTS voice alerts for ghost runner
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
          const splitSpeedKmh = (1000 / kmDuration) * 3.6;
          latestKmSplitRef.current = {
            km: currentKm,
            paceSecKm: kmDuration,
            speedKmh: splitSpeedKmh,
          };
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

          const isBike = sportRef.current === "cycling";
          // Compute cumulative elevation gain from points
          let elevGainM = 0;
          if (pointsRef.current.length > 1) {
            for (let i = 1; i < pointsRef.current.length; i++) {
              const ePrev = pointsRef.current[i - 1].elevation;
              const eCurr = pointsRef.current[i].elevation;
              if (ePrev !== undefined && eCurr !== undefined && eCurr > ePrev) {
                elevGainM += eCurr - ePrev;
              }
            }
          }

          const coachStats: VoiceCoachStats = {
            sport: sportRef.current,
            distanceM,
            elapsedSec,
            avgPaceSecKm,
            currentPaceSecKm,
            avgSpeedKmh: Number(avgSpeedKmh.toFixed(1)),
            currentSpeedKmh: Number(instantSpeedKmh.toFixed(1)),
            cadenceRpm: currentCadenceRef.current ?? powerCadenceRef.current ?? null,
            powerWatts: currentPowerRef.current ?? (isBike ? currentWatts : null),
            elevationGainM: Math.round(elevGainM),
            heartRate: currentHrRef.current,
            heartRateZoneName: hrZoneName,
            lastSplitKm: latestKmSplitRef.current?.km,
            lastSplitPaceSecKm: latestKmSplitRef.current?.paceSecKm,
            lastSplitSpeedKmh: latestKmSplitRef.current?.speedKmh,
          };

          const msg = buildVoiceCoachAnnouncement(coachStats, vConfig, language);
          if (msg) {
            speakWithConfig(msg, vConfig, language);
          }
        }
      }

      // ClimbPro Audio & Haptic Alerts (Etapa 6)
      if (currentClimbProg && statusRef.current === "recording" && vConfig && vConfig.enabled) {
        // 1. Alerta de Aproximação (150m antes)
        if (
          currentClimbProg.isApproachingClimb &&
          currentClimbProg.nextClimb &&
          lastApproachedClimbIdRef.current !== currentClimbProg.nextClimb.id
        ) {
          lastApproachedClimbIdRef.current = currentClimbProg.nextClimb.id;
          haptics.warning();
          const alertText = buildClimbApproachAnnouncement(
            currentClimbProg.nextClimb.climbIndex,
            currentClimbProg.totalClimbsCount,
            currentClimbProg.nextClimb.category,
            currentClimbProg.distanceToNextClimbM || 150,
            currentClimbProg.nextClimb.distanceM,
            currentClimbProg.nextClimb.avgGradePct,
            language
          );
          speakWithConfig(alertText, vConfig, language);
        }

        // 2. Início de Subida
        if (
          currentClimbProg.isActiveClimb &&
          currentClimbProg.currentClimb &&
          lastStartedClimbIdRef.current !== currentClimbProg.currentClimb.id
        ) {
          lastStartedClimbIdRef.current = currentClimbProg.currentClimb.id;
          activeClimbRef.current = currentClimbProg.currentClimb;
          wasInClimbRef.current = true;
          haptics.medium();
          const startText = buildClimbStartAnnouncement(
            currentClimbProg.currentClimb.climbIndex,
            currentClimbProg.totalClimbsCount,
            currentClimbProg.currentClimb.category,
            currentClimbProg.currentClimb.distanceM,
            currentClimbProg.currentClimb.avgGradePct,
            language
          );
          speakWithConfig(startText, vConfig, language);
        }

        // 3. Conclusão / Cume da Subida
        if (
          wasInClimbRef.current &&
          !currentClimbProg.isActiveClimb &&
          activeClimbRef.current &&
          lastCompletedClimbIdRef.current !== activeClimbRef.current.id
        ) {
          lastCompletedClimbIdRef.current = activeClimbRef.current.id;
          wasInClimbRef.current = false;
          haptics.success();
          const finishText = buildClimbCompletedAnnouncement(
            activeClimbRef.current.climbIndex,
            currentClimbProg.totalClimbsCount,
            activeClimbRef.current.elevationGainM,
            language
          );
          activeClimbRef.current = null;
          speakWithConfig(finishText, vConfig, language);
        }
      }
    },
    [speak, t, language, advanceStructuredWorkoutStep]
  );

  useEffect(() => {
    if (status !== "recording") return;
    const tick = setInterval(() => {
      const elapsed = getElapsedSec();
      const apConfig = autoPauseConfigRef.current;

      if (apConfig && apConfig.enabled && pointsRef.current.length >= 2) {
        const speedKmh = computeInstantSpeedKmh(pointsRef.current, 3);
        const currentSport = sportRef.current;
        const minSpeed = apConfig.minSpeedKmh || getDefaultAutoPauseSpeed(currentSport);
        const delay = apConfig.pauseDelaySec || 3;

        if (speedKmh < minSpeed) {
          lowSpeedCountRef.current += 1;
          if (lowSpeedCountRef.current >= delay && !isAutoPausedRef.current) {
            isAutoPausedRef.current = true;
            setIsAutoPaused(true);
            if (apConfig.audioFeedback) {
              playAutoPauseSound(true, language, currentSport);
            }
          }
        } else {
          lowSpeedCountRef.current = 0;
          if (isAutoPausedRef.current) {
            isAutoPausedRef.current = false;
            setIsAutoPaused(false);
            if (apConfig.audioFeedback) {
              playAutoPauseSound(false, language, currentSport);
            }
          }
        }
      }

      if (!isAutoPausedRef.current) {
        movingSecRef.current += 1;
      }

      recomputeStats(pointsRef.current, elapsed, movingSecRef.current, isAutoPausedRef.current);
    }, 1000);
    return () => clearInterval(tick);
  }, [status, getElapsedSec, recomputeStats, language]);

  const addPoint = useCallback(
    (lat: number, lng: number, elevation?: number, accuracy?: number) => {
      if (statusRef.current !== "recording") return;

      if (!acceptGpsReading(accuracy)) return;

      const now = new Date();
      const p: TrackPoint = {
        lat,
        lng,
        elevation,
        timestamp: now,
        hr: currentHrRef.current ?? undefined,
        cadence: currentCadenceRef.current ?? powerCadenceRef.current ?? undefined,
        watts: currentPowerRef.current ?? undefined,
      };

      if (!shouldAcceptPoint(pointsRef.current, p, sportRef.current)) {
        return;
      }

      const prev = pointsRef.current[pointsRef.current.length - 1];
      if (prev && !isAutoPausedRef.current) {
        const segDist = haversineM(prev.lat, prev.lng, p.lat, p.lng);
        distanceMRef.current += segDist;
      }

      pointsRef.current.push(p);
      setPoints([...pointsRef.current]);

      const elapsed = getElapsedSec();
      recomputeStats(pointsRef.current, elapsed, movingSecRef.current, isAutoPausedRef.current);

      if (routePoints.length > 0) {
        const proximity = pointToPolylineDistanceM(
          { lat: p.lat, lng: p.lng },
          routePoints
        );
        const tolerance = routeConfig?.offRouteToleranceM || 50;
        const offRoute = proximity.distanceM > tolerance;
        setOffRouteState({
          isOffRoute: offRoute,
          distanceFromRouteM: proximity.distanceM,
          nearestPoint: proximity.snappedPoint,
          estimatedDistanceM: 0,
          totalRouteDistanceM: 0,
        });
      }
    },
    [getElapsedSec, recomputeStats, routePoints, routeConfig]
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

  const start = useCallback(
    async (gConfig?: GhostConfig, sWorkout?: StructuredWorkout | null) => {
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

      // Reset Structured Workout
      if (sWorkout) {
        setStructuredWorkoutState(sWorkout);
        structuredWorkoutRef.current = sWorkout;
        const flattened = flattenWorkoutItems(sWorkout.items);
        setFlatSteps(flattened);
        flatStepsRef.current = flattened;
        setCurrentStepIndex(0);
        currentStepIndexRef.current = 0;
        stepStartTimeSecRef.current = 0;
        stepStartDistanceMRef.current = 0;
        executedStepsReportRef.current = [];
        lastPipSecRef.current = null;

        if (flattened.length > 0) {
          speakWorkoutStep(flattened[0], voiceCoachConfigRef.current, language);
        }
      } else {
        setStructuredWorkoutState(null);
        structuredWorkoutRef.current = null;
        setFlatSteps([]);
        flatStepsRef.current = [];
      }

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
    },
    [recomputeStats, startGpsWatch, language]
  );

  const pause = useCallback(() => {
    if (status !== "recording") return;
    stopGpsWatch();
    pausedAtRef.current = new Date();
    setStatus("paused");
  }, [status, stopGpsWatch]);

  const resume = useCallback(async () => {
    if (status !== "paused" || !pausedAtRef.current) return;
    totalPausedMsRef.current += Date.now() - pausedAtRef.current.getTime();
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

      // Finalize Structured Workout Report if active
      if (structuredWorkoutRef.current && flatStepsRef.current.length > 0) {
        const currIdx = currentStepIndexRef.current;
        const steps = flatStepsRef.current;

        // Record the last active step if not already recorded
        if (currIdx < steps.length) {
          const currentFlat = steps[currIdx];
          const durationSec = Math.max(1, Math.round(elapsedSec - stepStartTimeSecRef.current));
          const distanceM = Math.max(0, Math.round(distanceMRef.current - stepStartDistanceMRef.current));
          const avgPaceSecKm = distanceM > 10 && durationSec > 0 ? (durationSec / distanceM) * 1000 : null;
          const targetMet = evaluateStepTargetMet(currentFlat.step, {
            durationSec,
            distanceM,
            avgPaceSecKm,
          });

          executedStepsReportRef.current.push({
            stepIndex: currIdx,
            name: currentFlat.step.name || currentFlat.step.type,
            type: currentFlat.step.type,
            targetType: currentFlat.step.targetType,
            targetValue: currentFlat.step.targetValue,
            paceTarget: currentFlat.step.paceTarget,
            hrZoneTarget: currentFlat.step.hrZoneTarget,
            repeatIndex: currentFlat.repeatIndex,
            totalRepeats: currentFlat.totalRepeats,
            durationSec,
            distanceM,
            avgPaceSecKm,
            avgHr: currentHrRef.current,
            targetMet,
          });
        }

        const executedList = executedStepsReportRef.current;
        const metCount = executedList.filter((s) => s.targetMet).length;
        const complianceRatePercent = Math.round(
          (metCount / Math.max(1, executedList.length)) * 100
        );

        const report: StructuredWorkoutReport = {
          workoutId: structuredWorkoutRef.current.id,
          workoutName: structuredWorkoutRef.current.name,
          completedAt: endedAt.toISOString(),
          totalSteps: steps.length,
          completedSteps: executedList.length,
          complianceRatePercent,
          steps: executedList,
        };

        parsed.workoutId = structuredWorkoutRef.current.id;
        parsed.structuredWorkoutReport = report;
      }

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
      currentSpeedKmh: 0,
      avgSpeedKmh: 0,
      maxSpeedKmh: 0,
      currentWatts: 0,
      avgWatts: 0,
      currentCadenceRpm: null,
      avgCadenceRpm: 0,
      currentGradePercent: 0,
      currentVamMh: 0,
      isAutoPaused: false,
      powerSource: "estimated",
    });
    maxSpeedKmhRef.current = 0;
    totalElevationGainRef.current = 0;
    accumulatedWattsRef.current = [];
    accumulatedCadenceRef.current = [];
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
    setStructuredWorkoutState(null);
    structuredWorkoutRef.current = null;
    setFlatSteps([]);
    flatStepsRef.current = [];
    setCurrentStepIndex(0);
    currentStepIndexRef.current = 0;
    setStepElapsedSec(0);
    setStepDistanceM(0);
    executedStepsReportRef.current = [];
    manualLapsRef.current = [];
    setManualLaps([]);
    lapStartSecRef.current = 0;
    lapStartDistMRef.current = 0;
    lapNumberRef.current = 1;
    setCurrentLapNumber(1);
    setLastCompletedLap(null);
  }, [stopGpsWatch]);

  const triggerManualLap = useCallback(() => {
    if (status !== "recording" && status !== "paused") return null;

    const currentElapsed = stats.movingSec || stats.elapsedSec;
    const currentDist = stats.distanceM;
    const lapDuration = Math.max(1, currentElapsed - lapStartSecRef.current);
    const lapDistance = Math.max(0, currentDist - lapStartDistMRef.current);
    const lapSpeedKmh = lapDuration > 0 ? (lapDistance / lapDuration) * 3.6 : 0;

    const lap: ManualLap = {
      lapNumber: lapNumberRef.current,
      startedAtSec: lapStartSecRef.current,
      durationSec: lapDuration,
      distanceM: lapDistance,
      avgSpeedKmh: Math.round(lapSpeedKmh * 10) / 10,
      avgWatts: stats.currentWatts > 0 ? Math.round(stats.currentWatts) : undefined,
      avgHr: hrBpm !== null ? hrBpm : undefined,
    };

    const updated = [...manualLapsRef.current, lap];
    manualLapsRef.current = updated;
    setManualLaps(updated);
    setLastCompletedLap(lap);

    lapNumberRef.current += 1;
    setCurrentLapNumber(lapNumberRef.current);
    lapStartSecRef.current = currentElapsed;
    lapStartDistMRef.current = currentDist;

    playCountdownPip();
    return lap;
  }, [status, stats, hrBpm]);

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

  // ─── Cadence Sensor (CSC 0x1816) ─────────────────────────────────────────
  const connectCsc = useCallback(async () => {
    if (typeof window === "undefined") return;

    setCscStatus("connecting");
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
        services: [CSC_SERVICE],
      });

      const deviceId = device.deviceId;
      cscDeviceIdRef.current = deviceId;
      setCscDeviceName(device.name || "Sensor de Cadência");

      const onDisconnected = (disconnectedId: string) => {
        if (cscDeviceIdRef.current === disconnectedId) {
          setCscStatus("disconnected");
          setCscCadenceRpm(null);
          setCscDeviceName(null);
          currentCadenceRef.current = null;
          cscDeviceIdRef.current = null;
          cscParserRef.current.reset();
        }
      };

      await BleClient.connect(deviceId, onDisconnected);

      await BleClient.startNotifications(
        deviceId,
        CSC_SERVICE,
        CSC_MEASUREMENT_CHAR,
        (value: DataView) => {
          if (!value) return;
          const data = cscParserRef.current.parse(value);
          if (data.cadenceRpm !== null) {
            setCscCadenceRpm(data.cadenceRpm);
            currentCadenceRef.current = data.cadenceRpm;
          }
        }
      );

      setCscStatus("connected");
    } catch (err: any) {
      setCscStatus("disconnected");
      setCscCadenceRpm(null);
      setCscDeviceName(null);
      currentCadenceRef.current = null;
      cscDeviceIdRef.current = null;

      if (
        err.name === "NotFoundError" ||
        err.message?.includes("User cancelled") ||
        err.message?.includes("cancelled")
      ) {
        return;
      }

      setError(err instanceof Error ? err.message : "Erro ao conectar sensor de cadência.");
    }
  }, []);

  const disconnectCsc = useCallback(async () => {
    const deviceId = cscDeviceIdRef.current;
    if (deviceId) {
      try {
        await BleClient.stopNotifications(deviceId, CSC_SERVICE, CSC_MEASUREMENT_CHAR);
      } catch (err) {
        console.error("Error stopping CSC notifications:", err);
      }
      try {
        await BleClient.disconnect(deviceId);
      } catch (err) {
        console.error("Error disconnecting CSC:", err);
      }
    }
    setCscStatus("disconnected");
    setCscCadenceRpm(null);
    setCscDeviceName(null);
    currentCadenceRef.current = null;
    cscDeviceIdRef.current = null;
    cscParserRef.current.reset();
  }, []);

  // ─── Power Meter (CPS 0x1818) ────────────────────────────────────────────
  const connectPower = useCallback(async () => {
    if (typeof window === "undefined") return;

    setPowerStatus("connecting");
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
        services: [POWER_SERVICE],
      });

      const deviceId = device.deviceId;
      powerDeviceIdRef.current = deviceId;
      setPowerDeviceName(device.name || "Medidor de Potência");

      const onDisconnected = (disconnectedId: string) => {
        if (powerDeviceIdRef.current === disconnectedId) {
          setPowerStatus("disconnected");
          setPowerWatts(null);
          setPowerDeviceName(null);
          setPowerCadenceRpm(null);
          currentPowerRef.current = null;
          powerCadenceRef.current = null;
          powerDeviceIdRef.current = null;
          powerParserRef.current.reset();
        }
      };

      await BleClient.connect(deviceId, onDisconnected);

      await BleClient.startNotifications(
        deviceId,
        POWER_SERVICE,
        POWER_MEASUREMENT_CHAR,
        (value: DataView) => {
          if (!value) return;
          const data = powerParserRef.current.parse(value);

          setPowerWatts(data.instantaneousPowerWatts);
          currentPowerRef.current = data.instantaneousPowerWatts;

          // Cadência do Power Meter (se disponível)
          if (data.cadenceRpm !== null) {
            setPowerCadenceRpm(data.cadenceRpm);
            powerCadenceRef.current = data.cadenceRpm;
          }
        }
      );

      setPowerStatus("connected");
    } catch (err: any) {
      setPowerStatus("disconnected");
      setPowerWatts(null);
      setPowerDeviceName(null);
      setPowerCadenceRpm(null);
      currentPowerRef.current = null;
      powerCadenceRef.current = null;
      powerDeviceIdRef.current = null;

      if (
        err.name === "NotFoundError" ||
        err.message?.includes("User cancelled") ||
        err.message?.includes("cancelled")
      ) {
        return;
      }

      setError(err instanceof Error ? err.message : "Erro ao conectar medidor de potência.");
    }
  }, []);

  const disconnectPower = useCallback(async () => {
    const deviceId = powerDeviceIdRef.current;
    if (deviceId) {
      try {
        await BleClient.stopNotifications(deviceId, POWER_SERVICE, POWER_MEASUREMENT_CHAR);
      } catch (err) {
        console.error("Error stopping Power notifications:", err);
      }
      try {
        await BleClient.disconnect(deviceId);
      } catch (err) {
        console.error("Error disconnecting Power:", err);
      }
    }
    setPowerStatus("disconnected");
    setPowerWatts(null);
    setPowerDeviceName(null);
    setPowerCadenceRpm(null);
    currentPowerRef.current = null;
    powerCadenceRef.current = null;
    powerDeviceIdRef.current = null;
    powerParserRef.current.reset();
  }, []);

  // ─── Cleanup on Unmount ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopGpsWatch();
      const hrId = hrDeviceIdRef.current;
      if (hrId) {
        BleClient.disconnect(hrId).catch((err) => {
          console.error("Cleanup error disconnecting HR:", err);
        });
      }
      const cscId = cscDeviceIdRef.current;
      if (cscId) {
        BleClient.disconnect(cscId).catch((err) => {
          console.error("Cleanup error disconnecting CSC:", err);
        });
      }
      const powId = powerDeviceIdRef.current;
      if (powId) {
        BleClient.disconnect(powId).catch((err) => {
          console.error("Cleanup error disconnecting Power:", err);
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
  }, [offRouteState?.isOffRoute, offRouteState?.distanceFromRouteM, routeConfig?.audioAlerts, language, t]);

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
    // BLE Cadence (CSC)
    cscStatus,
    cscCadenceRpm,
    cscDeviceName,
    connectCsc,
    disconnectCsc,
    // BLE Power Meter
    powerStatus,
    powerWatts,
    powerDeviceName,
    powerCadenceRpm,
    connectPower,
    disconnectPower,
    // Ghost & Route
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
    // Structured Workout exports
    structuredWorkout,
    flatSteps,
    currentStepIndex,
    currentWorkoutStep: flatSteps[currentStepIndex] || null,
    nextWorkoutStep: flatSteps[currentStepIndex + 1] || null,
    stepElapsedSec,
    stepDistanceM,
    setStructuredWorkout,
    skipStructuredWorkoutStep,
    // Manual Laps (Feature 28)
    manualLaps,
    currentLapNumber,
    lastCompletedLap,
    triggerManualLap,
    // ClimbPro (Etapa 6)
    detectedClimbs,
    climbProgress: climbProgressState,
    routePoints,
  };
}
