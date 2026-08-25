import { describe, expect, it } from "vitest";
import { canStopRecorder } from "./recorder-state";

describe("recorder stop state", () => {
  it("allows stop only while recording or paused", () => {
    expect(canStopRecorder("recording")).toBe(true);
    expect(canStopRecorder("paused")).toBe(true);
    expect(canStopRecorder("idle")).toBe(false);
    expect(canStopRecorder("saving")).toBe(false);
  });
});
