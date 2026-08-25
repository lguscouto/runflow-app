export type ElevationPoint = {
  elevation?: number | null;
  autoPaused?: boolean;
};

export function accumulatePositiveElevationGain(
  points: ElevationPoint[],
  processedPointCount: number,
  isAutoPaused: boolean
): { deltaM: number; nextPointCount: number } {
  const safeProcessedCount = Math.max(0, Math.min(processedPointCount, points.length));
  let deltaM = 0;
  const firstSegmentIndex = Math.max(1, safeProcessedCount);

  if (!isAutoPaused) {
    for (let index = firstSegmentIndex; index < points.length; index += 1) {
      const previous = points[index - 1]?.elevation;
      const current = points[index]?.elevation;
      if (
        points[index - 1]?.autoPaused !== true &&
        points[index]?.autoPaused !== true &&
        typeof previous === "number" &&
        Number.isFinite(previous) &&
        typeof current === "number" &&
        Number.isFinite(current)
      ) {
        const delta = current - previous;
        if (delta > 0) deltaM += delta;
      }
    }
  }

  return {
    deltaM,
    nextPointCount: points.length,
  };
}
