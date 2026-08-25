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

    static String normalizeLanguageTag(String rawLanguage) {
        if (rawLanguage == null || rawLanguage.trim().isEmpty()) {
            return null;
        }

        String candidate = rawLanguage.trim().replace('_', '-');
        if (candidate.chars().anyMatch(Character::isWhitespace)) {
            return null;
        }

        Locale locale = Locale.forLanguageTag(candidate);
        String language = locale.getLanguage();
        if (language.isEmpty() || "und".equalsIgnoreCase(language)) {
            return null;
        }

        String normalized = locale.toLanguageTag();
        if (normalized.isEmpty() || "und".equalsIgnoreCase(normalized)) {
            return null;
        }

        // Locale.forLanguageTag silently truncates malformed input such as
        // "en--US" to "en". Reject anything that does not round-trip after
        // the intentional underscore-to-hyphen normalization above.
        return normalized.equalsIgnoreCase(candidate) ? normalized : null;
    }

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
        ret.put("language", "");
        call.resolve(ret);
    }

    @PluginMethod
    public void setAppLocale(PluginCall call) {
        String normalized = normalizeLanguageTag(call.getString("language"));
        boolean success = false;

        if (normalized != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            LocaleManager localeManager = getContext().getSystemService(LocaleManager.class);
            if (localeManager != null) {
                localeManager.setApplicationLocales(LocaleList.forLanguageTags(normalized));
                LocaleList applied = localeManager.getApplicationLocales();
                success = !applied.isEmpty()
                    && normalized.equalsIgnoreCase(applied.get(0).toLanguageTag());
            }
        }

        JSObject ret = new JSObject();
        ret.put("success", success);
        call.resolve(ret);
    }
}
