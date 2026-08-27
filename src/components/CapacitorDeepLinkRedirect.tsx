"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { getCapacitorDeepLinkEntryUrl } from "@/lib/capacitor-deep-link";

export function CapacitorDeepLinkRedirect() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const entryUrl = getCapacitorDeepLinkEntryUrl(
      window.location.pathname,
      window.location.search,
      window.location.hash,
    );
    if (entryUrl) window.location.replace(entryUrl);
  }, []);

  return null;
}
