import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const voiceMocks = vi.hoisted(() => ({
  cancelVoiceCoachSpeech: vi.fn(),
  formatPaceForSpeech: vi.fn(() => ""),
  speakWithConfig: vi.fn(),
}));

vi.mock("./voice-coach", () => voiceMocks);

import { playStartBlockChime, speakWorkoutStep, stopWorkoutAudio } from "./workout-audio";

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: AudioContextState = "running";
  currentTime = 0;
  destination = {};
  close = vi.fn(async () => {
    this.state = "closed";
  });
  resume = vi.fn(async () => {});

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createOscillator() {
    return {
      type: "sine" as OscillatorType,
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    } as unknown as OscillatorNode;
  }

  createGain() {
    return {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    } as unknown as GainNode;
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeAudioContext.instances = [];
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { AudioContext: FakeAudioContext },
  });
});

afterEach(() => {
  stopWorkoutAudio();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  Reflect.deleteProperty(globalThis, "window");
});

describe("workout audio lifecycle", () => {
  it("cancels delayed chimes and closes the audio context", async () => {
    playStartBlockChime();
    const context = FakeAudioContext.instances[0];

    stopWorkoutAudio();
    vi.advanceTimersByTime(500);
    await Promise.resolve();

    expect(context.close).toHaveBeenCalledTimes(1);
    expect(context.state).toBe("closed");
  });

  it("does not speak a delayed workout step after audio is stopped", () => {
    speakWorkoutStep(
      {
        stepId: "step-1",
        stepIndex: 0,
        totalSteps: 1,
        step: { id: "step-1", type: "work", targetType: "open", targetValue: 0 },
      } as never,
      {} as never
    );

    stopWorkoutAudio();
    vi.advanceTimersByTime(500);

    expect(voiceMocks.speakWithConfig).not.toHaveBeenCalled();
  });
});
