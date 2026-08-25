export type RecorderState = "idle" | "recording" | "paused" | "saving";

export function canStopRecorder(status: RecorderState): boolean {
  return status === "recording" || status === "paused";
}
