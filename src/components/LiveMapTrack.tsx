"use client";

import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Polyline, useMap } from "react-leaflet";
import { PrivacyAwareTileLayer } from "@/components/PrivacyAwareTileLayer";
import type { TrackPoint } from "@/lib/types";
import { boundsFromPoints } from "@/lib/geo";
import { colorTokens } from "@/lib/color-tokens";
import "leaflet/dist/leaflet.css";

function FollowLastPoint({
  points,
  follow,
}: {
  points: TrackPoint[];
  follow: boolean;
}) {
  const map = useMap();
  const last = points[points.length - 1];

  useEffect(() => {
    if (!follow || !last) return;
    map.setView([last.lat, last.lng], map.getZoom(), { animate: true });
  }, [map, follow, last]);

  return null;
}

function FitBoundsOnce({ points }: { points: TrackPoint[] }) {
  const map = useMap();
  const bounds = useMemo(() => boundsFromPoints(points), [points]);

  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(
        [
          [bounds.south, bounds.west],
          [bounds.north, bounds.east],
        ],
        { padding: [48, 48], maxZoom: 17 }
      );
    } else if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 16);
    }
  }, [map, bounds, points]);

  return null;
}

export function LiveMapTrack({
  points,
  follow = true,
  height = "280px",
}: {
  points: TrackPoint[];
  follow?: boolean;
  height?: string;
}) {
  const positions = points.map((p) => [p.lat, p.lng] as [number, number]);
  const center = positions[positions.length - 1] ?? [-23.55, -46.63];
  const last = points[points.length - 1];

  return (
    <div
      className="rounded-xl overflow-hidden border border-[var(--border)]"
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={16}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
        zoomControl={false}
      >
        <PrivacyAwareTileLayer
          provider="OpenStreetMap"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {positions.length > 1 && (
          <Polyline
            positions={positions}
            pathOptions={{ color: colorTokens.map.track, weight: 5, opacity: 0.95 }}
          />
        )}
        {last && (
          <CircleMarker
            center={[last.lat, last.lng]}
            radius={10}
            pathOptions={{
              color: colorTokens.map.marker,
              weight: 3,
              fillColor: colorTokens.map.track,
              fillOpacity: 1,
            }}
          />
        )}
        {follow && points.length > 0 ? (
          <FollowLastPoint points={points} follow />
        ) : (
          <FitBoundsOnce points={points} />
        )}
      </MapContainer>
    </div>
  );
}
