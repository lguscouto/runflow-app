"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  Polyline,
  TileLayer,
  CircleMarker,
  useMap,
} from "react-leaflet";
import type { TrackPoint, RoutePoint } from "@/lib/types";
import { boundsFromPoints, simplifyPoints } from "@/lib/geo";
import "leaflet/dist/leaflet.css";
import { useI18n } from "@/lib/i18n";

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length > 0) {
      const lats = points.map((p) => p[0]);
      const lngs = points.map((p) => p[1]);
      map.fitBounds(
        [
          [Math.min(...lats), Math.min(...lngs)],
          [Math.max(...lats), Math.max(...lngs)],
        ],
        { padding: [40, 40] }
      );
    }
  }, [map, points]);

  return null;
}

export function RouteMapOverlay({
  activityPoints,
  routePoints,
  height = "360px",
}: {
  activityPoints: TrackPoint[];
  routePoints: RoutePoint[];
  height?: string;
}) {
  const { t } = useI18n();

  const allPoints = useMemo(() => {
    const activity: [number, number][] = activityPoints.map((p) => [p.lat, p.lng]);
    const route: [number, number][] = routePoints.map((p) => [p.lat, p.lng]);
    return [...activity, ...route];
  }, [activityPoints, routePoints]);

  const routePositions = useMemo(
    () => simplifyPoints(routePoints, 800).map((p) => [p.lat, p.lng] as [number, number]),
    [routePoints]
  );

  const activityPositions = useMemo(
    () => simplifyPoints(activityPoints, 800).map((p) => [p.lat, p.lng] as [number, number]),
    [activityPoints]
  );

  const center = allPoints[0] ?? [-23.55, -46.63];

  if (allPoints.length < 2) {
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
    <div className="rounded-xl overflow-hidden border border-[var(--border)] relative" style={{ height }}>
      <MapContainer
        center={center}
        zoom={14}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* Route planned - dashed blue */}
        {routePositions.length >= 2 && (
          <Polyline
            positions={routePositions}
            pathOptions={{
              color: "#3b82f6",
              weight: 3,
              opacity: 0.6,
              dashArray: "8 6",
            }}
          />
        )}
        {/* Activity actual - solid orange */}
        {activityPositions.length >= 2 && (
          <Polyline
            positions={activityPositions}
            pathOptions={{ color: "#ff6b35", weight: 4, opacity: 0.9 }}
          />
        )}
        {/* Route waypoints */}
        {routePoints.map((p, i) => (
          <CircleMarker
            key={i}
            center={[p.lat, p.lng]}
            radius={4}
            pathOptions={{
              color: "#3b82f6",
              fillColor: "#3b82f6",
              fillOpacity: 0.7,
            }}
          />
        ))}
        <FitBounds points={allPoints} />
      </MapContainer>
      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2 text-xs flex flex-col gap-1 z-[1000]">
        <div className="flex items-center gap-2">
          <span className="w-4 h-0.5 bg-orange-500 inline-block" />
          <span className="text-white">{t("detail.actual_route")}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-0.5 border-t-2 border-dashed border-blue-400 inline-block" />
          <span className="text-white">{t("detail.planned_route")}</span>
        </div>
      </div>
    </div>
  );
}
