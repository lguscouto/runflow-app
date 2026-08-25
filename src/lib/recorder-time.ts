export type RecorderElapsedStatus = "idle" | "recording" | "paused" | "saving";

export function calculateElapsedSec(
  startedAtMs: number,
  nowMs: number,
  status: RecorderElapsedStatus,
  pausedAtMs?: number,
  totalPausedMs = 0,
): number {
  const endMs = status === "paused" && pausedAtMs != null ? pausedAtMs : nowMs;
  return Math.max(0, (endMs - startedAtMs) / 1000 - totalPausedMs / 1000);
}

export function calculateMovingSec(
  activeElapsedSec: number,
  nowMs: number,
  autoPausedAtMs?: number,
  totalAutoPausedMs = 0,
): number {
  if (!Number.isFinite(activeElapsedSec) || activeElapsedSec <= 0) return 0;

  const ongoingAutoPauseMs =
    autoPausedAtMs != null && Number.isFinite(autoPausedAtMs)
      ? Math.max(0, nowMs - autoPausedAtMs)
      : 0;
  const excludedSec = Math.max(0, totalAutoPausedMs + ongoingAutoPauseMs) / 1000;
  return Math.max(0, Math.min(activeElapsedSec, activeElapsedSec - excludedSec));
}
