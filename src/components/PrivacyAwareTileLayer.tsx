"use client";

import { Control, DomEvent, DomUtil } from "leaflet";
import { useEffect, useState, type ComponentProps } from "react";
import { TileLayer, useMap } from "react-leaflet";
import { useI18n } from "@/lib/i18n";

const CONSENT_KEY = "runflow:external-map-tiles-consent";

type PrivacyAwareTileLayerProps = ComponentProps<typeof TileLayer> & {
  provider: string;
};

function hasSessionConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(CONSENT_KEY) === "granted";
  } catch {
    return false;
  }
}

function grantSessionConsent(): boolean {
  try {
    window.sessionStorage.setItem(CONSENT_KEY, "granted");
    return true;
  } catch {
    return false;
  }
}

export function PrivacyAwareTileLayer({
  provider,
  ...tileLayerProps
}: PrivacyAwareTileLayerProps) {
  const map = useMap();
  const { t } = useI18n();
  const [allowed, setAllowed] = useState(hasSessionConsent);

  useEffect(() => {
    if (allowed) return;

    const consentControl = new Control({ position: "topright" });
    consentControl.onAdd = () => {
      const container = DomUtil.create("div", "leaflet-bar runflow-map-consent");
      const button = DomUtil.create("button", "", container) as HTMLButtonElement;
      button.type = "button";
      button.textContent = t("map.load_online_tiles");
      button.setAttribute("aria-label", t("map.load_online_tiles"));
      button.title = `${t("map.online_tiles_privacy")} ${provider}`;
      button.style.padding = "8px 10px";
      button.style.background = "var(--surface, var(--color-surface-panel))";
      button.style.color = "var(--text, var(--color-content-inverse))";
      button.style.border = "1px solid var(--border)";
      button.style.borderRadius = "6px";
      button.style.cursor = "pointer";
      button.style.fontSize = "12px";
      button.style.lineHeight = "1.2";
      button.onclick = () => {
        if (grantSessionConsent()) setAllowed(true);
      };
      DomEvent.disableClickPropagation(container);
      return container;
    };
    consentControl.addTo(map);
    return () => {
      consentControl.remove();
    };
  }, [allowed, map, provider, t]);

  return allowed ? <TileLayer {...tileLayerProps} /> : null;
}
