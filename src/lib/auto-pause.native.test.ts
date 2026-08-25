import { afterEach, describe, expect, it, vi } from "vitest";

const voiceMocks = vi.hoisted(() => ({
  DEFAULT_VOICE_COACH_CONFIG: { speechRate: 1, speechPitch: 1, speechVolume: 1 },
  speakWithConfig: vi.fn(),
  cancelVoiceCoachSpeech: vi.fn(),
}));

vi.mock("@/lib/voice-coach", () => voiceMocks);

import { playAutoPauseSound } from "./auto-pause";

afterEach(() => {
  voiceMocks.speakWithConfig.mockClear();
  Reflect.deleteProperty(globalThis, "window");
});

describe("auto-pause native fallback", () => {
  it("uses the native voice bridge when Web Speech is unavailable", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {},
    });

    playAutoPauseSound(true, "pt", "running");

    expect(voiceMocks.speakWithConfig).toHaveBeenCalledWith(
      "Treino pausado automaticamente",
      voiceMocks.DEFAULT_VOICE_COACH_CONFIG,
      "pt"
    );
  });

  it("uses the native voice bridge when Web Speech is present but unusable", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { speechSynthesis: undefined },
    });

    playAutoPauseSound(true, "pt", "running");

    expect(voiceMocks.speakWithConfig).toHaveBeenCalledTimes(1);
  });
});