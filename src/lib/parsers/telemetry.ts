const MAX_HEART_RATE_BPM = 260;
const MAX_CADENCE_RPM = 300;
const MAX_POWER_WATTS = 5_000;
const MAX_SPEED_KMH = 180;
const MIN_ELEVATION_M = -1_000;
const MAX_ELEVATION_M = 10_000;
const MAX_CALORIES = 100_000;

function finite(value: number | undefined): number | undefined {
  return value != null && Number.isFinite(value) ? value : undefined;
}

export function normalizeHeartRate(value: number | undefined): number | undefined {
  const normalized = finite(value);
  return normalized != null && normalized >= 20 && normalized <= MAX_HEART_RATE_BPM
    ? Math.trunc(normalized)
    : undefined;
}

export function normalizeCadence(value: number | undefined): number | undefined {
  const normalized = finite(value);
  return normalized != null && normalized >= 0 && normalized <= MAX_CADENCE_RPM
    ? Math.trunc(normalized)
    : undefined;
}

export function normalizePower(value: number | undefined): number | undefined {
  const normalized = finite(value);
  return normalized != null && normalized >= 0 && normalized <= MAX_POWER_WATTS
    ? normalized
    : undefined;
}

export function normalizeSpeedKmh(value: number | undefined): number | undefined {
  const normalized = finite(value);
  return normalized != null && normalized >= 0 && normalized <= MAX_SPEED_KMH
    ? normalized
    : undefined;
}

export function normalizeElevation(value: number | undefined): number | undefined {
  const normalized = finite(value);
  return normalized != null && normalized >= MIN_ELEVATION_M && normalized <= MAX_ELEVATION_M
    ? normalized
    : undefined;
}

export function normalizeCalories(value: number | undefined): number | undefined {
  const normalized = finite(value);
  return normalized != null && normalized >= 0 && normalized <= MAX_CALORIES
    ? normalized
    : undefined;
}

export function normalizeNonNegative(
  value: number | undefined,
  maximum: number
): number | undefined {
  const normalized = finite(value);
  return normalized != null && normalized >= 0 && normalized <= maximum
    ? normalized
    : undefined;
}
