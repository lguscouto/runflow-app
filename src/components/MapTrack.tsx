"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Polyline, useMap } from "react-leaflet";
import { PrivacyAwareTileLayer } from "@/components/PrivacyAwareTileLayer";
import type { TrackPoint } from "@/lib/types";
import { boundsFromPoints, simplifyPoints } from "@/lib/geo";
import "leaflet/dist/leaflet.css";
import { useI18n } from "@/lib/i18n";

function FitBounds({ points }: { points: TrackPoint[] }) {
  const map = useMap();
  const bounds = useMemo(() => boundsFromPoints(points), [points]);

  useEffect(() => {
    if (points.length > 0) {
      map.fitBounds(
        [
          [bounds.south, bounds.west],
          [bounds.north, bounds.east],
        ],
        { padding: [40, 40] }
      );
    }
  }, [map, bounds, points.length]);

  return null;
}

export function MapTrack({
  points,
  height = "var(--map-height)",
}: {
  points: TrackPoint[];
  height?: string;
}) {
  const { t } = useI18n();
  const simplifiedPoints = useMemo(() => simplifyPoints(points, 800), [points]);
  const positions = useMemo(() => simplifiedPoints.map((p) => [p.lat, p.lng] as [number, number]), [simplifiedPoints]);
  const center = positions[0] ?? [-23.55, -46.63];

  if (positions.length < 2) {
    return (
      <div
        className="rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)]"
        style={{ height }}
      >
        {t("map.no_gps")}
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden border border-[var(--border)]"
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={14}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <PrivacyAwareTileLayer
          provider="OpenStreetMap"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline
          positions={positions}
          pathOptions={{ color: "#ff6b35", weight: 4, opacity: 0.9 }}
        />
        <FitBounds points={simplifiedPoints} />
      </MapContainer>
    </div>
  );
}
