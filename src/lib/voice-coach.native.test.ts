import { afterEach, describe, expect, it, vi } from "vitest";

const nativeSpeech = vi.hoisted(() => ({
  speak: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => true,
  },
  registerPlugin: () => nativeSpeech,
}));

import { cancelVoiceCoachSpeech, speakWithConfig } from "./voice-coach";
import { DEFAULT_VOICE_COACH_CONFIG } from "./voice-coach";

afterEach(() => {
  nativeSpeech.speak.mockClear();
  nativeSpeech.stop.mockClear();
  Reflect.deleteProperty(globalThis, "window");
});

describe("native voice coach fallback", () => {
  it("uses native TTS when Android WebView has no speechSynthesis", async () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {},
    });

    speakWithConfig("Treino iniciado", DEFAULT_VOICE_COACH_CONFIG, "pt");
    await Promise.resolve();

    expect(nativeSpeech.speak).toHaveBeenCalledWith({
      text: "Treino iniciado",
      lang: "pt-BR",
      rate: 1,
      pitch: 1,
      volume: 1,
    });
  });

  it("stops native TTS when the recorder loses focus", async () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {},
    });

    cancelVoiceCoachSpeech();
    await Promise.resolve();

    expect(nativeSpeech.stop).toHaveBeenCalledTimes(1);
  });

  it("converts a synchronous native bridge exception into a controlled failure", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {},
    });
    nativeSpeech.speak.mockImplementation(() => {
      throw new Error("bridge unavailable");
    });

    expect(() => speakWithConfig("Treino iniciado", DEFAULT_VOICE_COACH_CONFIG, "pt")).not.toThrow();
  });

  it("uses native TTS when speechSynthesis exists but is unusable", async () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { speechSynthesis: {} },
    });

    speakWithConfig("Treino iniciado", DEFAULT_VOICE_COACH_CONFIG, "pt");
    await Promise.resolve();

    expect(nativeSpeech.speak).toHaveBeenCalledTimes(1);
  });
});
