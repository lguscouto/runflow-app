export type FlyoverQualityTier = "high" | "balanced" | "low";

export interface FlyoverQualityInput {
  width: number;
  height: number;
  devicePixelRatio: number;
  antialias: boolean;
  segments: number;
  /** Optional telemetry only. It must not decide the quality tier. */
  deviceMemory?: number;
}

export interface FlyoverBudget {
  width: number;
  height: number;
  devicePixelRatio: number;
  pixelCount: number;
  antialiasFactor: number;
  segmentFactor: number;
  segments: number;
  workUnits: number;
}

export interface FlyoverQualityDecision {
  tier: FlyoverQualityTier;
  pixelRatio: number;
  antialias: boolean;
  segments: number;
  budget: FlyoverBudget;
}

const SEGMENT_BASELINE = 600;
const HIGH_WORK_UNITS = 8_000_000;
const BALANCED_WORK_UNITS = 20_000_000;

function finitePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Estimates the amount of work for one Flyover frame.
 *
 * This intentionally uses only the dimensions that directly change the render
 * cost: viewport pixels, DPR, antialiasing, and tube segments. `deviceMemory`
 * is accepted as optional telemetry for callers, but is not part of the
 * estimate or the tier decision.
 */
export function measureFlyoverBudget(input: FlyoverQualityInput): FlyoverBudget {
  const width = Math.ceil(finitePositive(input.width, 1));
  const height = Math.ceil(finitePositive(input.height, 1));
  const devicePixelRatio = Math.min(
    3,
    Math.max(1, finitePositive(input.devicePixelRatio, 1)),
  );
  const segments = Math.max(1, Math.ceil(finitePositive(input.segments, 1)));
  const pixelCount = Math.ceil(width * devicePixelRatio) * Math.ceil(height * devicePixelRatio);
  const antialiasFactor = input.antialias ? 1.25 : 1;
  const segmentFactor = Math.max(1, segments / SEGMENT_BASELINE);

  return {
    width,
    height,
    devicePixelRatio,
    pixelCount,
    antialiasFactor,
    segmentFactor,
    segments,
    workUnits: pixelCount * antialiasFactor * segmentFactor,
  };
}

/**
 * Selects a deterministic renderer profile from the measured frame budget.
 * Memory hints are deliberately not used as a proxy for GPU capability.
 */
export function selectFlyoverQuality(input: FlyoverQualityInput): FlyoverQualityDecision {
  const budget = measureFlyoverBudget(input);
  const tier: FlyoverQualityTier =
    budget.workUnits <= HIGH_WORK_UNITS
      ? "high"
      : budget.workUnits <= BALANCED_WORK_UNITS
        ? "balanced"
        : "low";

  if (tier === "high") {
    return {
      tier,
      pixelRatio: Math.min(budget.devicePixelRatio, 2),
      antialias: input.antialias,
      segments: Math.min(budget.segments, 1_500),
      budget,
    };
  }

  if (tier === "balanced") {
    return {
      tier,
      pixelRatio: Math.min(budget.devicePixelRatio, 1.5),
      antialias: false,
      segments: Math.min(budget.segments, 900),
      budget,
    };
  }

  return {
    tier,
    pixelRatio: 1,
    antialias: false,
    segments: Math.min(budget.segments, 450),
    budget,
  };
}
