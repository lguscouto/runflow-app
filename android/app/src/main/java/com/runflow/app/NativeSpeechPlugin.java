package com.runflow.app;

import android.os.Bundle;
import android.speech.tts.TextToSpeech;

import androidx.annotation.NonNull;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;
import java.util.concurrent.atomic.AtomicReference;

@CapacitorPlugin(name = "NativeSpeech")
public class NativeSpeechPlugin extends Plugin {
    private final NativeSpeechEngineState<SpeechRequest> engineState = new NativeSpeechEngineState<>();
    private final Object engineLock = new Object();
    private TextToSpeech textToSpeech;

    static String normalizeLanguageTag(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        String candidate = value.trim();
        if (!candidate.matches("[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*")) {
            return null;
        }
        Locale locale = Locale.forLanguageTag(candidate);
        String language = locale.getLanguage();
        if (!("pt".equals(language) || "en".equals(language))) {
            return null;
        }
        if (language == null || language.isEmpty() || "und".equals(locale.toLanguageTag())) {
            return null;
        }
        String normalized = locale.toLanguageTag();
        if (normalized.isEmpty()) {
            return null;
        }
        return normalized;
    }

    static float clampRate(double value) {
        if (!Double.isFinite(value)) return 1.0f;
        return (float) Math.max(0.6, Math.min(2.0, value));
    }

    static float clampPitch(double value) {
        if (!Double.isFinite(value)) return 1.0f;
        return (float) Math.max(0.5, Math.min(1.5, value));
    }

    static float clampVolume(double value) {
        if (!Double.isFinite(value)) return 1.0f;
        return (float) Math.max(0.1, Math.min(1.0, value));
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "");
        if (text == null || text.trim().isEmpty()) {
            call.reject("Speech text is required");
            return;
        }

        String languageTag = normalizeLanguageTag(call.getString("lang", "pt-BR"));
        if (languageTag == null) {
            call.reject("Unsupported speech language");
            return;
        }

        double rate = call.getData().optDouble("rate", 1.0);
        double pitch = call.getData().optDouble("pitch", 1.0);
        double volume = call.getData().optDouble("volume", 1.0);
        SpeechRequest request = new SpeechRequest(
                call,
                text,
                languageTag,
                clampRate(rate),
                clampPitch(pitch),
                clampVolume(volume)
        );

        synchronized (engineLock) {
            if (textToSpeech == null && !engineState.isInitializing()) {
                startInitialization(request);
                return;
            }

            if (engineState.isInitializing()) {
                SpeechRequest superseded = engineState.replacePending(request);
                reject(superseded, "Speech request superseded");
                return;
            }

            if (!engineState.isInitialized()) {
                startInitialization(request);
                return;
            }

            speakPending(request, textToSpeech);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        synchronized (engineLock) {
            SpeechRequest pending;
            if (engineState.isInitialized()) {
                pending = engineState.cancelPending();
                safeStop(textToSpeech);
            } else {
                pending = engineState.cancelInitialization();
                shutdownTextToSpeech();
            }
            reject(pending, "Native speech stopped");
        }
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        synchronized (engineLock) {
            SpeechRequest pending = engineState.cancelInitialization();
            reject(pending, "Native speech destroyed");
            shutdownTextToSpeech();
        }
        super.handleOnDestroy();
    }

    private void startInitialization(SpeechRequest request) {
        synchronized (engineLock) {
            SpeechRequest superseded = engineState.beginInitialization(request);
            reject(superseded, "Speech request superseded");
            final long generation = engineState.currentGeneration();
            AtomicReference<TextToSpeech> engineRef = new AtomicReference<>();
            AtomicReference<Integer> earlyStatus = new AtomicReference<>();
            try {
                TextToSpeech engine = new TextToSpeech(getContext(), status -> {
                    synchronized (engineLock) {
                        TextToSpeech callbackEngine = engineRef.get();
                        if (callbackEngine == null) {
                            earlyStatus.set(status);
                            return;
                        }
                        handleInitializationLocked(generation, callbackEngine, status);
                    }
                });
                engineRef.set(engine);
                textToSpeech = engine;
                Integer status = earlyStatus.getAndSet(null);
                if (status != null) {
                    handleInitializationLocked(generation, engine, status);
                }
            } catch (RuntimeException error) {
                SpeechRequest pending = engineState.failInitialization();
                reject(pending, "Native speech engine initialization failed");
                shutdownTextToSpeech(engineRef.get());
            }
        }
    }

    private void handleInitialization(long generation, TextToSpeech engine, int status) {
        synchronized (engineLock) {
            handleInitializationLocked(generation, engine, status);
        }
    }

    private void handleInitializationLocked(long generation, TextToSpeech engine, int status) {
        if (engine == null || engine != textToSpeech
                || !engineState.isCurrentInitialization(generation)) {
            return;
        }
        if (status != TextToSpeech.SUCCESS) {
            SpeechRequest pending = engineState.failInitialization();
            reject(pending, "Native speech engine initialization failed");
            shutdownTextToSpeech(engine);
            return;
        }
        SpeechRequest pending = engineState.completeInitialization();
        if (pending != null) {
            speakPending(pending, engine);
        }
    }

    private void speakPending(@NonNull SpeechRequest request, TextToSpeech engine) {
        if (engine == null || engine != textToSpeech || !engineState.isInitialized()) {
            reject(request, "Native speech engine is unavailable");
            return;
        }
        try {
            Locale locale = Locale.forLanguageTag(request.languageTag);
            int languageStatus = engine.setLanguage(locale);
            if (languageStatus == TextToSpeech.LANG_MISSING_DATA
                    || languageStatus == TextToSpeech.LANG_NOT_SUPPORTED) {
                request.call.reject("Speech language is not available");
                return;
            }

            engine.setSpeechRate(request.rate);
            engine.setPitch(request.pitch);
            Bundle parameters = new Bundle();
            parameters.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, request.volume);
            int result = engine.speak(
                    request.text,
                    TextToSpeech.QUEUE_FLUSH,
                    parameters,
                    "runflow-voice-coach"
            );
            if (result == TextToSpeech.ERROR) {
                request.call.reject("Native speech failed");
            } else {
                request.call.resolve();
            }
        } catch (RuntimeException error) {
            request.call.reject("Native speech failed");
            if (engine == textToSpeech) {
                shutdownTextToSpeech(engine);
            }
        }
    }

    private void shutdownTextToSpeech() {
        shutdownTextToSpeech(textToSpeech);
    }

    private void shutdownTextToSpeech(TextToSpeech engine) {
        if (engine != null) {
            safeStop(engine);
            try {
                engine.shutdown();
            } catch (RuntimeException ignored) {
                // Best effort cleanup; state is invalidated below.
            }
        }
        if (textToSpeech == engine) {
            textToSpeech = null;
        }
        engineState.teardown();
    }

    private static void safeStop(TextToSpeech engine) {
        if (engine != null) {
            try {
                engine.stop();
            } catch (RuntimeException ignored) {
                // Cleanup must not strand a PluginCall.
            }
        }
    }

    private static void reject(SpeechRequest request, String message) {
        if (request != null) {
            request.call.reject(message);
        }
    }

    private static final class SpeechRequest {
        private final PluginCall call;
        private final String text;
        private final String languageTag;
        private final float rate;
        private final float pitch;
        private final float volume;

        private SpeechRequest(
                PluginCall call,
                String text,
                String languageTag,
                float rate,
                float pitch,
                float volume
        ) {
            this.call = call;
            this.text = text;
            this.languageTag = languageTag;
            this.rate = rate;
            this.pitch = pitch;
            this.volume = volume;
        }
    }
}
