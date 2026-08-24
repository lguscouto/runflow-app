package com.runflow.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
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

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject ret = new JSObject();
        // Em versões anteriores ao Android 17 (API 37), a permissão de rede local é concedida por padrão
        if (Build.VERSION.SDK_INT < 37) {
            ret.put("status", "granted");
            call.resolve(ret);
            return;
        }

        int permissionCheck = ContextCompat.checkSelfPermission(
            getContext(),
            "android.permission.ACCESS_LOCAL_NETWORK"
        );

        if (permissionCheck == PackageManager.PERMISSION_GRANTED) {
            ret.put("status", "granted");
        } else {
            ret.put("status", "denied");
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < 37) {
            JSObject ret = new JSObject();
            ret.put("status", "granted");
            call.resolve(ret);
            return;
        }

        requestPermissionForAlias("localNetwork", call, "permissionCallback");
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void permissionCallback(PluginCall call) {
        JSObject ret = new JSObject();
        int permissionCheck = ContextCompat.checkSelfPermission(
            getContext(),
            "android.permission.ACCESS_LOCAL_NETWORK"
        );

        if (permissionCheck == PackageManager.PERMISSION_GRANTED) {
            ret.put("status", "granted");
        } else {
            ret.put("status", "denied");
        }
        call.resolve(ret);
    }
}
