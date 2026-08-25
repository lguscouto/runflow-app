package com.runflow.app;

import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
    name = "LocalNetworkPermission",
    permissions = {
        @Permission(
            strings = { "android.permission.ACCESS_LOCAL_NETWORK" },
            alias = "localNetwork"
        )
    }
)
public class LocalNetworkPermissionPlugin extends Plugin {
    private static final String LOCAL_NETWORK_PERMISSION =
        "android.permission.ACCESS_LOCAL_NETWORK";
    private static final int LOCAL_NETWORK_PERMISSION_API = 37;

    static String statusFor(int permissionCheck, boolean shouldShowRationale) {
        if (permissionCheck == PackageManager.PERMISSION_GRANTED) {
            return "granted";
        }
        if (permissionCheck == PackageManager.PERMISSION_DENIED) {
            return shouldShowRationale ? "rationale" : "denied";
        }
        return "unavailable";
    }

    static String statusForSdk(
        int sdkInt,
        int permissionCheck,
        boolean shouldShowRationale
    ) {
        if (sdkInt < LOCAL_NETWORK_PERMISSION_API) {
            return "granted";
        }
        return statusFor(permissionCheck, shouldShowRationale);
    }

    private String readPermissionStatus() {
        if (Build.VERSION.SDK_INT < LOCAL_NETWORK_PERMISSION_API) {
            return "granted";
        }
        try {
            if (getActivity() == null) {
                return "unavailable";
            }
            int permissionCheck = ContextCompat.checkSelfPermission(
                getContext(),
                LOCAL_NETWORK_PERMISSION
            );
            boolean rationale = ActivityCompat.shouldShowRequestPermissionRationale(
                getActivity(),
                LOCAL_NETWORK_PERMISSION
            );
            return statusForSdk(Build.VERSION.SDK_INT, permissionCheck, rationale);
        } catch (RuntimeException error) {
            return "unavailable";
        }
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("status", readPermissionStatus());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < LOCAL_NETWORK_PERMISSION_API) {
            JSObject ret = new JSObject();
            ret.put("status", "granted");
            call.resolve(ret);
            return;
        }
        if (getActivity() == null) {
            JSObject ret = new JSObject();
            ret.put("status", "unavailable");
            call.resolve(ret);
            return;
        }
        requestPermissionForAlias("localNetwork", call, "permissionCallback");
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void permissionCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("status", readPermissionStatus());
        call.resolve(ret);
    }
}
