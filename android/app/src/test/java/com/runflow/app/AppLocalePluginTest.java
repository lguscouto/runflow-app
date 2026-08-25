package com.runflow.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public class AppLocalePluginTest {
    @Test
    public void normalizesValidLocaleTags() {
        assertEquals("pt-BR", AppLocalePlugin.normalizeLanguageTag("pt-br"));
        assertEquals("en", AppLocalePlugin.normalizeLanguageTag(" en "));
    }

    @Test
    public void rejectsBlankOrMalformedLocaleTags() {
        assertNull(AppLocalePlugin.normalizeLanguageTag(null));
        assertNull(AppLocalePlugin.normalizeLanguageTag(" "));
        assertNull(AppLocalePlugin.normalizeLanguageTag("not a locale"));
    }

    @Test
    public void rejectsIllFormedTagsInsteadOfSilentlyTruncatingThem() {
        assertNull(AppLocalePlugin.normalizeLanguageTag("en--US"));
        assertNull(AppLocalePlugin.normalizeLanguageTag("en-"));
        assertNull(AppLocalePlugin.normalizeLanguageTag("-US"));
    }
}
