import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_VOICE_COACH_CONFIG,
  cancelVoiceCoachSpeech,
  formatDistanceForSpeech,
  formatDurationForSpeech,
  speakWithConfig,
} from "./voice-coach";

function installSpeechMock() {
  const speechSynthesis = {
    cancel: vi.fn(),
    speak: vi.fn(),
    getVoices: vi.fn(() => []),
  };

  class FakeSpeechSynthesisUtterance {
    text: string;
    lang = "";
    rate = 1;
    pitch = 1;
    volume = 1;
    voice: unknown;

    constructor(text: string) {
      this.text = text;
    }
  }

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { speechSynthesis },
  });
  Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
    configurable: true,
    value: FakeSpeechSynthesisUtterance,
  });

  return { speechSynthesis };
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(globalThis, "window");
  Reflect.deleteProperty(globalThis, "SpeechSynthesisUtterance");
});

describe("voice coach lifecycle", () => {
  it("does not speak non-finite distance or duration values", () => {
    expect(formatDistanceForSpeech(Number.NaN, "pt")).toBe("");
    expect(formatDistanceForSpeech(Number.POSITIVE_INFINITY, "pt")).toBe("");
    expect(formatDurationForSpeech(Number.NaN, "pt")).toBe("");
    expect(formatDurationForSpeech(Number.POSITIVE_INFINITY, "pt")).toBe("");
  });

  it("clamps non-finite Web Speech settings to safe defaults", () => {
    const { speechSynthesis } = installSpeechMock();

    speakWithConfig(
      "Teste de voz",
      {
        ...DEFAULT_VOICE_COACH_CONFIG,
        speechRate: Number.NaN,
        speechPitch: Number.POSITIVE_INFINITY,
        speechVolume: Number.NEGATIVE_INFINITY,
      },
      "pt"
    );

    const utterance = speechSynthesis.speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.rate).toBe(1);
    expect(utterance.pitch).toBe(1);
    expect(utterance.volume).toBe(1);
  });

  it("cancels an active utterance when the recorder leaves the foreground", () => {
    const { speechSynthesis } = installSpeechMock();

    speakWithConfig("Treino iniciado", DEFAULT_VOICE_COACH_CONFIG, "pt");
    cancelVoiceCoachSpeech();

    expect(speechSynthesis.speak).toHaveBeenCalledTimes(1);
    expect(speechSynthesis.cancel).toHaveBeenCalledTimes(2);
  });
});
