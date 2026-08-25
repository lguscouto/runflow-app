"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { dispatchAndroidBack } from "@/lib/android-back";

export function CapacitorInit() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    StatusBar.setBackgroundColor({ color: "#0c0f14" }).catch(() => {});

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
