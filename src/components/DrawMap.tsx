"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Polyline, CircleMarker, useMapEvents } from "react-leaflet";
import { PrivacyAwareTileLayer } from "@/components/PrivacyAwareTileLayer";
import type { RoutePoint } from "@/lib/types";
import "leaflet/dist/leaflet.css";

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function mapLeaflet(point: RoutePoint): [number, number] {
  return [point.lat, point.lng];
}

export function DrawMap({
  points,
  onMapClick,
  height = "420px",
}: {
  points: RoutePoint[];
  onMapClick: (lat: number, lng: number) => void;
  height?: string;
}) {
  const center = useMemo<[number, number]>(() => {
    if (points.length > 0) {
      return [points[0].lat, points[0].lng];
    }
    return [-23.55, -46.63]; // Default: São Paulo
  }, [points]);

  // Force map resize when points change
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (containerRef.current) {
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 200);
    }
  }, []);

  const positions = useMemo<[number, number][]>(
    () => points.map((p) => [p.lat, p.lng]),
    [points]
  );
  const hasPoints = points.length > 0;

  return (
    <div
      ref={containerRef}
      className="rounded-xl overflow-hidden border border-[var(--border)]"
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={hasPoints ? 14 : 6}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <PrivacyAwareTileLayer
          provider="OpenStreetMap"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {hasPoints && (
          <>
            <Polyline
              positions={positions}
              pathOptions={{ color: "#ff6b35", weight: 4, opacity: 0.9 }}
            />
            {points.map((p, i) => (
              <CircleMarker
                key={`${p.lat}-${p.lng}-${i}`}
                center={[p.lat, p.lng]}
                radius={6}
                pathOptions={{
                  color: "#ffffff",
                  fillColor: i === 0 ? "#10b981" : i === points.length - 1 ? "#ef4444" : "#ff6b35",
                  fillOpacity: 1,
                  weight: 2,
                }}
              />
            ))}
          </>
        )}
        <MapClickHandler onClick={onMapClick} />
      </MapContainer>
    </div>
  );
}
