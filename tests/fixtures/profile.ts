import type { UserProfile } from "@/lib/types";

export function makeSyntheticProfile(
  overrides: Partial<UserProfile> = {}
): UserProfile {
  return {
    name: "Perfil sintético",
    onboarded: true,
    age: 30,
    heightCm: 170,
    weightKg: 70,
    bodyFatPercent: 18,
    weeklyDistanceKm: 30,
    weeklyWorkouts: 4,
    prMinPaceDistanceKm: 5,
    maxHr: 190,
    restingHr: 55,
    cyclingFtpWatts: 220,
    voiceCoach: {
      enabled: true,
      triggerType: "distance",
      distanceIntervalM: 1_000,
      timeIntervalSec: 300,
      speakDistance: true,
      speakTime: true,
      speakAvgPace: true,
      speakCurrentPace: false,
      speakHeartRate: true,
      speakHeartRateZone: true,
      speakLastSplit: true,
      speakSpeedKmh: true,
      speakCurrentSpeedKmh: false,
      speakCadence: true,
      speakPowerWatts: true,
      speakElevationGain: true,
      speechRate: 1,
      speechPitch: 1,
      speechVolume: 1,
    },
    autoPause: {
      enabled: true,
      minSpeedKmh: 1.5,
      pauseDelaySec: 3,
      audioFeedback: true,
    },
    language: "pt",
    updatedAt: "2026-08-20T12:00:00.000Z",
    ...overrides,
  };
}

export const makeProfile = makeSyntheticProfile;
