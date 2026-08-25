package com.runflow.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.Bridge;
import java.util.Arrays;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class AppContextInstrumentedTest {

    @Test
    public void installedApplicationMatchesAndroidContract() throws Exception {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        ApplicationInfo applicationInfo = appContext.getApplicationInfo();
        assertEquals("com.runflow.app", appContext.getPackageName());
        assertEquals(33, applicationInfo.minSdkVersion);
        assertEquals(36, applicationInfo.targetSdkVersion);

        PackageInfo packageInfo = appContext.getPackageManager().getPackageInfo(
                appContext.getPackageName(),
                PackageManager.GET_PERMISSIONS
        );
        assertNotNull(packageInfo.requestedPermissions);
        assertTrue(Arrays.asList(packageInfo.requestedPermissions)
                .contains("android.permission.ACCESS_LOCAL_NETWORK"));
        assertTrue(Arrays.asList(packageInfo.requestedPermissions)
                .contains("android.permission.BLUETOOTH_SCAN"));
        assertTrue(Arrays.asList(packageInfo.requestedPermissions)
                .contains("android.permission.BLUETOOTH_CONNECT"));
    }

    @Test
    public void mainActivityRegistersRunFlowPlugins() {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        Intent intent = new Intent(appContext, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        Activity activity = InstrumentationRegistry.getInstrumentation().startActivitySync(intent);
        try {
            Bridge bridge = ((MainActivity) activity).getBridge();
            assertNotNull(bridge);
            assertNotNull(bridge.getPlugin("AppLocale"));
            assertNotNull(bridge.getPlugin("LocalNetworkPermission"));
            assertNotNull(bridge.getPlugin("NativeSpeech"));
        } finally {
            activity.finish();
        }
    }
}
