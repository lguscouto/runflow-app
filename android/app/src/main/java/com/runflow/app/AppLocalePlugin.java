package com.runflow.app;

import android.app.LocaleManager;
import android.os.Build;
import android.os.LocaleList;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Locale;

@CapacitorPlugin(name = "AppLocale")
public class AppLocalePlugin extends Plugin {

    @PluginMethod
    public void getAppLocale(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            LocaleManager localeManager = getContext().getSystemService(LocaleManager.class);
            if (localeManager != null) {
                LocaleList locales = localeManager.getApplicationLocales();
                if (!locales.isEmpty()) {
                    ret.put("language", locales.get(0).toLanguageTag());
                    call.resolve(ret);
                    return;
                }
            }
        }
        ret.put("language", Locale.getDefault().toLanguageTag());
        call.resolve(ret);
    }

    @PluginMethod
    public void setAppLocale(PluginCall call) {
        String lang = call.getString("language");
        if (lang != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            LocaleManager localeManager = getContext().getSystemService(LocaleManager.class);
            if (localeManager != null) {
                LocaleList localeList = LocaleList.forLanguageTags(lang);
                localeManager.setApplicationLocales(localeList);
            }
        }
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }
}
