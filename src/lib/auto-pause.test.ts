import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cancelAutoPauseSound,
  appendAutoPauseBoundaryPoint,
  appendAutoPauseResumePoint,
  computeAutoPauseResumeSpeedKmh,
  computeInstantSpeedKmh,
  playAutoPauseSound,
} from "./auto-pause";

function installSpeechMock() {
  const speechSynthesis = {
    cancel: vi.fn(),
    speak: vi.fn(),
  };
  class FakeSpeechSynthesisUtterance {
    lang = "";
    rate = 1;
    volume = 1;
    constructor(public text: string) {}
  }
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { speechSynthesis },
  });
  Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
    configurable: true,
    value: FakeSpeechSynthesisUtterance,
  });
  return speechSynthesis;
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
  Reflect.deleteProperty(globalThis, "SpeechSynthesisUtterance");
});

describe("auto-pause audio lifecycle", () => {
  it("normalizes invalid GPS speed to a finite stopped value", () => {
    const points = [
      { lat: Number.NaN, lng: 0, timestamp: new Date(0) },
      { lat: Number.NaN, lng: 0, timestamp: new Date(1000) },
    ];

    expect(computeInstantSpeedKmh(points, 3)).toBe(0);
  });

  it("does not calculate speed across an auto-paused boundary", () => {
    const points = [
      { lat: -22.9, lng: -43.2, timestamp: new Date(0) },
      { lat: -22.9, lng: -43.2, timestamp: new Date(1_000), autoPaused: true },
      { lat: -22.9, lng: -43.199, timestamp: new Date(2_000) },
    ];

    expect(computeInstantSpeedKmh(points, 3)).toBe(0);
  });

  it("can detect movement to resume after auto-pause", () => {
    const points = [
      { lat: -22.9, lng: -43.2, timestamp: new Date(0) },
      { lat: -22.9, lng: -43.2, timestamp: new Date(1_000), autoPaused: true },
      { lat: -22.9, lng: -43.199, timestamp: new Date(2_000), autoPaused: true },
    ];

    expect(computeAutoPauseResumeSpeedKmh(points, 3)).toBeGreaterThan(1.5);
  });

  it("preserves the paused marker and appends an active resume point", () => {
    const points = [
      { lat: -22.9, lng: -43.2, timestamp: new Date(0) },
      { lat: -22.9, lng: -43.199, timestamp: new Date(1_000), autoPaused: true },
    ];

    const resumed = appendAutoPauseResumePoint(points);

    expect(resumed).toHaveLength(3);
    expect(resumed[1].autoPaused).toBe(true);
    expect(resumed[2].autoPaused).toBe(false);
  });

  it("adds a boundary marker for a manual pause", () => {
    const points = [{ lat: -22.9, lng: -43.2, timestamp: new Date(0) }];

    const paused = appendAutoPauseBoundaryPoint(points);

    expect(paused).toHaveLength(2);
    expect(paused[0].autoPaused).toBeUndefined();
    expect(paused[1].autoPaused).toBe(true);
  });

  it("cancels an auto-pause announcement on teardown", () => {
    const speechSynthesis = installSpeechMock();

    playAutoPauseSound(true, "pt", "running");
    cancelAutoPauseSound();

    expect(speechSynthesis.speak).toHaveBeenCalledTimes(1);
    expect(speechSynthesis.cancel).toHaveBeenCalledTimes(2);
  });
});
