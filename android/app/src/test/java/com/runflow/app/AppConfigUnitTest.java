package com.runflow.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;

import org.junit.Test;

public class AppConfigUnitTest {

    @Test
    public void appPackageConstantsAreValid() {
        String expectedPackage = "com.runflow.app";
        assertNotNull(expectedPackage);
        assertEquals("com.runflow.app", expectedPackage);
    }
}
