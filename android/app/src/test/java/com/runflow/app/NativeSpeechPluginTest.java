package com.runflow.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public class NativeSpeechPluginTest {
    @Test
    public void acceptsSupportedLanguageTags() {
        assertEquals("pt-BR", NativeSpeechPlugin.normalizeLanguageTag("pt-br"));
        assertEquals("en-US", NativeSpeechPlugin.normalizeLanguageTag(" en-US "));
        assertEquals("pt", NativeSpeechPlugin.normalizeLanguageTag("pt"));
    }

    @Test
    public void rejectsUnsupportedOrMalformedLanguageTags() {
        assertNull(NativeSpeechPlugin.normalizeLanguageTag("not a locale"));
        assertNull(NativeSpeechPlugin.normalizeLanguageTag("fr-FR"));
        assertNull(NativeSpeechPlugin.normalizeLanguageTag("en--US"));
        assertNull(NativeSpeechPlugin.normalizeLanguageTag("-US"));
        assertNull(NativeSpeechPlugin.normalizeLanguageTag(null));
    }

    @Test
    public void clampsSpeechParametersToSafeRuntimeRanges() {
        assertEquals(0.6f, NativeSpeechPlugin.clampRate(0.1), 0.001f);
        assertEquals(2.0f, NativeSpeechPlugin.clampRate(4.0), 0.001f);
        assertEquals(0.5f, NativeSpeechPlugin.clampPitch(0.1), 0.001f);
        assertEquals(1.5f, NativeSpeechPlugin.clampPitch(4.0), 0.001f);
        assertEquals(0.1f, NativeSpeechPlugin.clampVolume(0.0), 0.001f);
        assertEquals(1.0f, NativeSpeechPlugin.clampVolume(4.0), 0.001f);
    }

    @Test
    public void nonFiniteSpeechParametersUseSafeDefaults() {
        assertEquals(1.0f, NativeSpeechPlugin.clampRate(Double.NaN), 0.001f);
        assertEquals(1.0f, NativeSpeechPlugin.clampRate(Double.POSITIVE_INFINITY), 0.001f);
        assertEquals(1.0f, NativeSpeechPlugin.clampPitch(Double.NEGATIVE_INFINITY), 0.001f);
        assertEquals(1.0f, NativeSpeechPlugin.clampVolume(Double.NaN), 0.001f);
    }
}
