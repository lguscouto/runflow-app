package com.runflow.app;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class AppConfigUnitTest {

    @Test
    public void buildConfigMatchesReleaseContract() {
        assertEquals("com.runflow.app", BuildConfig.APPLICATION_ID);
        assertEquals("0.9.8", BuildConfig.VERSION_NAME);
        assertEquals(4, BuildConfig.VERSION_CODE);
    }
}
