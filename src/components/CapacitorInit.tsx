"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { dispatchAndroidBack } from "@/lib/android-back";
import { colorTokens } from "@/lib/color-tokens";
import { useAppTheme } from "@/components/ThemeProvider";

export function CapacitorInit() {
  const { theme } = useAppTheme();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    StatusBar.setStyle({ style: theme === "light" ? Style.Light : Style.Dark }).catch(() => {});
    StatusBar.setBackgroundColor({
      color: theme === "light" ? colorTokens.lightMode.background : colorTokens.surface.app,
    }).catch(() => {});
  }, [theme]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const backButtonListener = App.addListener("backButton", ({ canGoBack }) => {
      if (dispatchAndroidBack()) return;
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp().catch(() => {});
      }
    });

    return () => {
      backButtonListener.then((handle) => handle.remove()).catch(() => {});
    };
  }, []);

  return null;
}
