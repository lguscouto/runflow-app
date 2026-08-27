"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  MapContainer,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import { PrivacyAwareTileLayer } from "@/components/PrivacyAwareTileLayer";
import "leaflet/dist/leaflet.css";
import {
  Flame,
  Layers,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sliders,
  Sparkles,
  MapPin,
  Calendar,
  Activity,
  Compass,
} from "lucide-react";
import { getAllStoredRoutes } from "@/lib/storage";
import { forEachHeatmapBatch, type HeatmapTrack } from "@/lib/heatmap-data";
import type { SavedRoute, Sport } from "@/lib/types";
import { formatPace, formatSpeed, formatWatts, formatDistance, formatDuration } from "@/lib/format";
import { simplifyPoints } from "@/lib/geo";
import { useI18n } from "@/lib/i18n";
import { colorTokens } from "@/lib/color-tokens";

export type HeatmapTheme = "flame" | "cyan" | "sunset" | "lime" | "strava" | "velo";
export type HeatmapBasemap = "dark" | "light" | "osm" | "satellite";
export type HeatmapStroke = "thin" | "medium" | "thick";

export const HEATMAP_THEMES: Record<
  HeatmapTheme,
  {
    nameKey: string;
    coreColor: string;
    glowColor: string;
    accentColor: string;
    previewBg: string;
  }
> = {
  flame: {
    nameKey: "heatmap.theme_flame",
    coreColor: colorTokens.heatmap.flame.core,
    glowColor: colorTokens.heatmap.flame.glow,
    accentColor: colorTokens.heatmap.flame.accent,
    previewBg: "bg-gradient-to-r from-red-600 via-orange-500 to-amber-400",
  },
  velo: {
    nameKey: "heatmap.theme_velo",
    coreColor: colorTokens.heatmap.velo.core,
    glowColor: colorTokens.heatmap.velo.glow,
    accentColor: colorTokens.heatmap.velo.accent,
    previewBg: "bg-gradient-to-r from-amber-500 via-yellow-400 to-cyan-400",
  },
  cyan: {
    nameKey: "heatmap.theme_cyan",
    coreColor: colorTokens.heatmap.cyan.core,
    glowColor: colorTokens.heatmap.cyan.glow,
    accentColor: colorTokens.heatmap.cyan.accent,
    previewBg: "bg-gradient-to-r from-blue-600 via-cyan-400 to-teal-300",
  },
  sunset: {
    nameKey: "heatmap.theme_sunset",
    coreColor: colorTokens.heatmap.sunset.core,
    glowColor: colorTokens.heatmap.sunset.glow,
    accentColor: colorTokens.heatmap.sunset.accent,
    previewBg: "bg-gradient-to-r from-purple-600 via-pink-500 to-amber-300",
  },
  lime: {
    nameKey: "heatmap.theme_lime",
    coreColor: colorTokens.heatmap.lime.core,
    glowColor: colorTokens.heatmap.lime.glow,
    accentColor: colorTokens.heatmap.lime.accent,
    previewBg: "bg-gradient-to-r from-emerald-600 via-green-400 to-lime-300",
  },
  strava: {
    nameKey: "heatmap.theme_strava",
    coreColor: colorTokens.heatmap.strava.core,
    glowColor: colorTokens.heatmap.strava.glow,
    accentColor: colorTokens.heatmap.strava.accent,
    previewBg: "bg-gradient-to-r from-orange-700 via-orange-500 to-amber-400",
  },
};

const BASEMAP_URLS: Record<
  HeatmapBasemap,
  { url: string; attribution: string; maxZoom: number }
> = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
  },
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
    maxZoom: 18,
  },
};

function MapRecenter({
  allPoints,
  triggerCount,
}: {
  allPoints: [number, number][];
  triggerCount: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (allPoints.length === 0) return;
    const lats = allPoints.map((p) => p[0]);
    const lngs = allPoints.map((p) => p[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    if (!isNaN(minLat) && !isNaN(maxLat) && !isNaN(minLng) && !isNaN(maxLng)) {
      map.fitBounds(
        [
          [minLat, minLng],
          [maxLat, maxLng],
        ],
        { padding: [50, 50], maxZoom: 16 }
      );
    }
  }, [map, allPoints, triggerCount]);

  return null;
}

export function PersonalHeatmap({
  fullHeight = false,
}: {
  fullHeight?: boolean;
}) {
  const { t, language } = useI18n();

  // Data states
  const [tracks, setTracks] = useState<HeatmapTrack[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & customization states
  const [selectedSport, setSelectedSport] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [includeRoutes, setIncludeRoutes] = useState(false);
  const [theme, setTheme] = useState<HeatmapTheme>("flame");
  const [basemap, setBasemap] = useState<HeatmapBasemap>("dark");
  const [stroke, setStroke] = useState<HeatmapStroke>("medium");
  const [opacity, setOpacity] = useState<number>(0.8);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [recenterCount, setRecenterCount] = useState(0);

  // Load routes once; activity tracks are streamed separately below.
  useEffect(() => {
    let mounted = true;
    getAllStoredRoutes()
      .then((storedRoutes) => {
        if (mounted) setRoutes(storedRoutes);
      })
      .catch((err) => {
        if (mounted) console.error("Failed to load heatmap routes:", err);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Stream only the tracks matching the current filters.
  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    setLoading(true);
    setTracks([]);

    void forEachHeatmapBatch(
      {
        batchSize: 25,
        signal: controller.signal,
        filter: (summary) => {
          if (selectedSport !== "all" && summary.sport !== selectedSport) {
            return false;
          }
          if (selectedYear !== "all") {
            return new Date(summary.startedAt).getFullYear().toString() === selectedYear;
          }
          return true;
        },
      },
      async (batch) => {
        if (mounted) setTracks((current) => [...current, ...batch]);
      },
    )
      .then((result) => {
        if (mounted) setAvailableYears(result.availableYears);
      })
      .catch((err) => {
        if (mounted && err instanceof Error && err.name !== "AbortError") {
          console.error("Failed to stream heatmap data:", err);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [selectedSport, selectedYear]);


  // Tracks are already filtered and simplified by the streaming loader.
  const filteredTracks = useMemo<HeatmapTrack[]>(() => {
    const list = [...tracks];

    if (includeRoutes) {
      routes.forEach((route) => {
        if (!route.points || route.points.length < 2) return;
        const simplified = simplifyPoints(route.points, 400);
        const points: [number, number][] = simplified.map((p) => [p.lat, p.lng]);
        if (points.length >= 2) {
          list.push({
            id: route.id,
            name: route.name,
            sport: "running",
            startedAt: route.createdAt,
            distanceM: route.distanceM,
            durationSec: 0,
            avgPaceSecKm: null,
            points,
            isRoute: true,
          });
        }
      });
    }

    return list;
  }, [tracks, routes, includeRoutes]);

  // Flattened points for center and bounds
  const allPoints = useMemo<[number, number][]>(() => {
    return filteredTracks.flatMap((track) => track.points);
  }, [filteredTracks]);

  // Compute summary stats
  const totalStats = useMemo(() => {
    const totalDistM = filteredTracks.reduce((acc, t) => acc + t.distanceM, 0);
    const totalPts = allPoints.length;
    return {
      activitiesCount: filteredTracks.filter((t) => !t.isRoute).length,
      routesCount: filteredTracks.filter((t) => t.isRoute).length,
      distanceKm: (totalDistM / 1000).toFixed(1),
      pointsCount: totalPts.toLocaleString(),
    };
  }, [filteredTracks, allPoints.length]);

  const defaultCenter = useMemo<[number, number]>(() => {
    if (allPoints.length > 0) {
      return allPoints[0];
    }
    return [-23.5505, -46.6333]; // São Paulo default
  }, [allPoints]);

  // Styling params based on selections
  const strokeWeights = {
    thin: { core: 1.5, glow: 3.5 },
    medium: { core: 3.0, glow: 7.0 },
    thick: { core: 5.0, glow: 12.0 },
  }[stroke];

  const currentTheme = HEATMAP_THEMES[theme];

  return (
    <div
      className={`relative flex flex-col rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--color-surface-map)] transition-all duration-300 ${
        isFullscreen
          ? "fixed inset-0 z-[9999] rounded-none border-none h-screen w-screen"
          : fullHeight
          ? "h-[calc(100vh-140px)] w-full"
          : "h-[620px] w-full"
      }`}
    >
      {/* Top Floating Control Bar */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Quick Sport Filter Tabs */}
        <div className="flex items-center gap-1 bg-[var(--color-surface-github)]/90 backdrop-blur-md p-1 rounded-xl border border-[var(--border)] text-xs text-[var(--text)] pointer-events-auto shadow-lg">
          {[
            { id: "all", label: t("heatmap.sport_all"), icon: "🌐" },
            { id: "running", label: t("sport.running"), icon: "🏃" },
            { id: "cycling", label: t("sport.cycling"), icon: "🚴" },
            { id: "walking", label: t("sport.walking"), icon: "🚶" },
          ].map((sp) => (
            <button
              key={sp.id}
              type="button"
              onClick={() => {
                setSelectedSport(sp.id);
                if (sp.id === "cycling" && theme === "flame") {
                  setTheme("velo");
                }
              }}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedSport === sp.id
                  ? sp.id === "cycling"
                    ? "bg-amber-500 text-black font-bold shadow"
                    : "bg-[var(--accent)] text-[var(--on-accent)] shadow"
                  : "text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              <span>{sp.icon}</span>
              <span className="hidden sm:inline">{sp.label}</span>
            </button>
          ))}
        </div>

        {/* Right Badges / Actions */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Total Distance & Activity Count Badge */}
          <div className="hidden md:flex items-center gap-2 bg-[var(--color-surface-github)]/90 backdrop-blur-md border border-[var(--border)] px-3 py-1.5 rounded-xl shadow-lg text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-[var(--text)] font-semibold">
              {totalStats.distanceKm} km
            </span>
            <span className="text-[var(--muted)]">
              ({totalStats.activitiesCount} {selectedSport === "cycling" ? "pedais" : selectedSport === "running" ? "corridas" : "treinos"})
            </span>
          </div>

          {/* Controls Toggle */}
          <button
            type="button"
            onClick={() => setShowControls(!showControls)}
            className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border shadow-lg transition-all cursor-pointer ${
              showControls
                ? "bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)]"
                : "bg-[var(--color-surface-github)]/90 backdrop-blur-md text-[var(--text)] border-[var(--border)] hover:bg-[var(--color-surface-github-hover)]"
            }`}
            title="Ajustes do Mapa de Calor"
          >
            <Sliders size={16} />
            <span className="hidden sm:inline">Ajustes</span>
          </button>

          {/* Recenter */}
          <button
            type="button"
            onClick={() => setRecenterCount((c) => c + 1)}
            className="p-2 rounded-xl bg-[var(--color-surface-github)]/90 backdrop-blur-md text-[var(--text)] border border-[var(--border)] hover:bg-[var(--color-surface-github-hover)] shadow-lg transition-all cursor-pointer"
            title={t("heatmap.fit_bounds")}
          >
            <RefreshCw size={16} />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl bg-[var(--color-surface-github)]/90 backdrop-blur-md text-[var(--text)] border border-[var(--border)] hover:bg-[var(--color-surface-github-hover)] shadow-lg transition-all cursor-pointer"
            title={isFullscreen ? t("heatmap.exit_fullscreen") : t("heatmap.fullscreen")}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Expandable Controls Panel */}
      {showControls && (
        <div className="absolute top-16 left-3 right-3 sm:right-auto sm:w-96 z-[1000] bg-[var(--color-surface-github)]/95 backdrop-blur-xl border border-[var(--border)] p-4 rounded-2xl shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto pointer-events-auto text-[var(--text)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
            <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
              <Sliders size={16} className="text-[var(--accent)]" />
              Controles do Heatmap
            </h3>
            <button
              type="button"
              onClick={() => setShowControls(false)}
              className="p-1.5 text-sm font-bold text-[var(--muted)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Color Themes */}
          <div className="space-y-1.5">
            <span id="heatmap-theme-label" className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-400" />
              {t("heatmap.theme")}
            </span>
            <div role="group" aria-labelledby="heatmap-theme-label" className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {(Object.keys(HEATMAP_THEMES) as HeatmapTheme[]).map((thm) => {
                const item = HEATMAP_THEMES[thm];
                const active = theme === thm;
                return (
                  <button
                    key={thm}
                    type="button"
                    onClick={() => setTheme(thm)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                      active
                        ? "border-[var(--accent)] bg-[var(--color-surface-github-hover)] text-[var(--text)] ring-2 ring-[var(--accent)]"
                        : "border-[var(--border)] bg-[var(--color-surface-map)] text-[var(--muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full ${item.previewBg} shrink-0`} />
                    <span className="truncate">{t(item.nameKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Basemap Style */}
          <div className="space-y-1.5">
            <span id="heatmap-basemap-label" className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1.5">
              <Layers size={13} className="text-[var(--color-status-info)]" />
              {t("heatmap.basemap")}
            </span>
            <div role="group" aria-labelledby="heatmap-basemap-label" className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: "dark", labelKey: "heatmap.basemap_dark" },
                  { id: "light", labelKey: "heatmap.basemap_light" },
                  { id: "osm", labelKey: "heatmap.basemap_osm" },
                  { id: "satellite", labelKey: "heatmap.basemap_satellite" },
                ] as const
              ).map((bm) => (
                <button
                  key={bm.id}
                  type="button"
                  onClick={() => setBasemap(bm.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border text-left transition-all cursor-pointer ${
                    basemap === bm.id
                      ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]"
                      : "border-[var(--border)] bg-[var(--color-surface-map)] text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {t(bm.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Sport Filter */}
          <div className="space-y-1.5">
            <label htmlFor="heatmap-sport" className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1.5">
              <Activity size={13} className="text-emerald-400" />
              {t("heatmap.sport_filter")}
            </label>
            <select
              id="heatmap-sport"
              value={selectedSport}
              onChange={(e) => setSelectedSport(e.target.value)}
              className="w-full text-xs p-2 rounded-lg bg-[var(--color-surface-map)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="all">{t("heatmap.sport_all")}</option>
              <option value="running">🏃 {t("heatmap.sport_running")}</option>
              <option value="walking">🚶 {t("heatmap.sport_walking")}</option>
              <option value="cycling">🚴 {t("heatmap.sport_cycling")}</option>
              <option value="other">⚡ {t("heatmap.sport_other")}</option>
            </select>
          </div>

          {/* Year Filter */}
          {availableYears.length > 0 && (
            <div className="space-y-1.5">
              <label htmlFor="heatmap-year" className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1.5">
                <Calendar size={13} className="text-purple-400" />
                {t("heatmap.year_filter")}
              </label>
              <select
                id="heatmap-year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full text-xs p-2 rounded-lg bg-[var(--color-surface-map)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="all">{t("heatmap.year_all")}</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Stroke Width & Opacity */}
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[var(--border)]">
            <div className="space-y-1.5">
              <span id="heatmap-stroke-label" className="text-xs font-semibold text-[var(--muted)]">
                {t("heatmap.stroke")}
              </span>
              <div role="group" aria-labelledby="heatmap-stroke-label" className="flex bg-[var(--color-surface-map)] border border-[var(--border)] rounded-lg p-0.5">
                {(["thin", "medium", "thick"] as HeatmapStroke[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStroke(st)}
                    className={`flex-1 py-1 text-xs rounded font-semibold transition-all cursor-pointer ${
                      stroke === st
                        ? "bg-[var(--accent)] text-[var(--on-accent)]"
                        : "text-[var(--muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    {t(`heatmap.stroke_${st}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="heatmap-opacity" className="text-xs font-semibold text-[var(--muted)]">
                {t("heatmap.opacity")} ({Math.round(opacity * 100)}%)
              </label>
              <input
                id="heatmap-opacity"
                type="range"
                min="0.3"
                max="1.0"
                step="0.1"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-full accent-[var(--accent)] cursor-pointer mt-2"
              />
            </div>
          </div>

          {/* Saved Routes Toggle */}
          <div className="pt-2 border-t border-[var(--border)]">
            <label className="flex items-center gap-2 text-xs text-[var(--muted)] hover:text-[var(--text)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeRoutes}
                onChange={(e) => setIncludeRoutes(e.target.checked)}
                className="accent-[var(--accent)] rounded"
              />
              <Compass size={13} className="text-cyan-400" />
              <span>{t("heatmap.show_routes")}</span>
            </label>
          </div>
        </div>
      )}

      {/* Main Map Canvas */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--muted)]">
          <RefreshCw size={28} className="animate-spin text-[var(--accent)]" />
          <p className="text-sm font-semibold">{t("common.loading")}</p>
        </div>
      ) : filteredTracks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center text-[var(--muted)]">
          <Flame size={36} className="text-[var(--muted)]/50" />
          <p className="text-sm max-w-xs">{t("heatmap.no_activities")}</p>
        </div>
      ) : (
        <div className="flex-1 w-full h-full relative">
          <MapContainer
            center={defaultCenter}
            zoom={13}
            style={{ height: "100%", width: "100%", background: "var(--color-surface-hud)" }}
            scrollWheelZoom
          >
            {/* Tile Base Layer */}
            <PrivacyAwareTileLayer
              provider={basemap === "satellite" ? "Esri" : basemap === "osm" ? "OpenStreetMap" : "CARTO"}
              url={BASEMAP_URLS[basemap].url}
              attribution={BASEMAP_URLS[basemap].attribution}
              maxZoom={BASEMAP_URLS[basemap].maxZoom}
            />

            {/* Recenter hook */}
            <MapRecenter allPoints={allPoints} triggerCount={recenterCount} />

            {/* Heatmap Overlapping Polylines with Multi-Stroke Neon Glow */}
            {filteredTracks.map((track) => (
              <React.Fragment key={track.id}>
                {/* 1. Outer Glow Polyline (Wide & Semi-transparent) */}
                <Polyline
                  positions={track.points}
                  pathOptions={{
                    color: track.isRoute ? colorTokens.map.elevation : currentTheme.glowColor,
                    weight: strokeWeights.glow,
                    opacity: opacity * 0.4,
                    lineCap: "round",
                    lineJoin: "round",
                  }}
                  interactive={false}
                />

                {/* 2. Core Polyline (Crisp and Focused) */}
                <Polyline
                  positions={track.points}
                  pathOptions={{
                    color: track.isRoute ? colorTokens.map.routeActive : currentTheme.coreColor,
                    weight: strokeWeights.core,
                    opacity: opacity * 0.95,
                    lineCap: "round",
                    lineJoin: "round",
                  }}
                >
                  <Popup className="heatmap-popup">
                    <div className="p-1 space-y-1.5 min-w-[170px] text-gray-900">
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <MapPin size={13} className="text-orange-700 shrink-0" />
                        <span className="truncate">{track.name}</span>
                      </div>
                      <div className="text-[11px] text-gray-600">
                        📅 {new Date(track.startedAt).toLocaleDateString(language === "pt" ? "pt-BR" : "en-US")}
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[11px] bg-gray-100 p-1.5 rounded">
                        <div>
                          <span className="text-gray-500 block text-[9px]">Distância</span>
                          <strong className="text-gray-900">{formatDistance(track.distanceM)}</strong>
                        </div>
                        {track.sport === "cycling" && track.avgSpeedKmh ? (
                          <div>
                            <span className="text-gray-500 block text-[9px]">Vel. Média</span>
                            <strong className="text-gray-900">{formatSpeed(track.avgSpeedKmh)}</strong>
                          </div>
                        ) : track.avgPaceSecKm ? (
                          <div>
                            <span className="text-gray-500 block text-[9px]">Ritmo</span>
                            <strong className="text-gray-900">{formatPace(track.avgPaceSecKm)}</strong>
                          </div>
                        ) : (
                          <div>
                            <span className="text-gray-500 block text-[9px]">Duração</span>
                            <strong className="text-gray-900">{formatDuration(track.durationSec)}</strong>
                          </div>
                        )}
                      </div>
                      {track.avgWatts && track.avgWatts > 0 && (
                        <div className="text-[10px] text-amber-800 font-semibold bg-amber-50 px-1.5 py-0.5 rounded flex items-center justify-between">
                          <span>⚡ Potência Média:</span>
                          <span>{formatWatts(track.avgWatts)}</span>
                        </div>
                      )}
                      {!track.isRoute && (
                        <Link
                          href={`/atividades/ver?id=${track.id}`}
                          className="block text-center text-xs font-bold text-orange-700 hover:text-orange-800 pt-1"
                        >
                          {t("heatmap.view_activity")} →
                        </Link>
                      )}
                    </div>
                  </Popup>
                </Polyline>
              </React.Fragment>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}
