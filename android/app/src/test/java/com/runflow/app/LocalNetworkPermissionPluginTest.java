package com.runflow.app;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class LocalNetworkPermissionPluginTest {
    @Test
    public void mapsPermissionStateToThePublicContract() {
        assertEquals("granted", LocalNetworkPermissionPlugin.statusFor(0, false));
        assertEquals("rationale", LocalNetworkPermissionPlugin.statusFor(-1, true));
        assertEquals("denied", LocalNetworkPermissionPlugin.statusFor(-1, false));
        assertEquals("unavailable", LocalNetworkPermissionPlugin.statusFor(-2, false));
    }

    @Test
    public void treatsPreAndroid17AsImplicitlyGrantedWithoutARequest() {
        assertEquals("granted", LocalNetworkPermissionPlugin.statusForSdk(33, -1, false));
        assertEquals("granted", LocalNetworkPermissionPlugin.statusForSdk(36, -1, true));
        assertEquals("denied", LocalNetworkPermissionPlugin.statusForSdk(37, -1, false));
        assertEquals("rationale", LocalNetworkPermissionPlugin.statusForSdk(37, -1, true));
    }
}
