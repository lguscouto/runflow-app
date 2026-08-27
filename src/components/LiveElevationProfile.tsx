"use client";

import React, { useMemo } from "react";
import type { ClimbSegment, RoutePoint } from "@/lib/types";
import { getCategoryBadgeStyle } from "@/lib/climb-detection";
import { formatDistance, formatElevation } from "@/lib/format";
import { getGradeColorVar } from "@/lib/color-tokens";
import { Mountain, ZoomIn, ZoomOut } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface LiveElevationProfileProps {
  points: Array<{ lat: number; lng: number; elevation?: number }>;
  climbs?: ClimbSegment[];
  currentDistM: number;
  activeClimb?: ClimbSegment | null;
  height?: number;
  showControls?: boolean;
  zoomMode?: "full" | "climb";
  onToggleZoom?: () => void;
  className?: string;
}

export function LiveElevationProfile({
  points,
  climbs = [],
  currentDistM,
  activeClimb = null,
  height = 130,
  showControls = true,
  zoomMode = "full",
  onToggleZoom,
  className = "",
}: LiveElevationProfileProps) {
  const { t } = useI18n();

  // Prepara os dados normalizados do perfil
  const profileData = useMemo(() => {
    if (!points || points.length < 2) return null;

    // Calcular distâncias acumuladas
    const items: Array<{ distM: number; elevM: number; gradePct: number }> = [];
    let accumDist = 0;

    // Haversine inline rápido
    const toRad = (x: number) => (x * Math.PI) / 180;
    const calcDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371000;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    items.push({
      distM: 0,
      elevM: points[0].elevation ?? 0,
      gradePct: 0,
    });

    for (let i = 1; i < points.length; i++) {
      const d = calcDist(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
      accumDist += d;
      const elev = points[i].elevation ?? points[i - 1].elevation ?? 0;
      const prevElev = points[i - 1].elevation ?? elev;
      const grade = d > 0 ? ((elev - prevElev) / d) * 100 : 0;

      items.push({
        distM: accumDist,
        elevM: elev,
        gradePct: grade,
      });
    }

    if (items.length < 2) return null;

    // Filtrar janela de visualização baseada no modo de zoom
    let displayPoints = items;
    let minDist = 0;
    let maxDist = accumDist;

    if (zoomMode === "climb" && activeClimb) {
      minDist = Math.max(0, activeClimb.startDistM - 50);
      maxDist = activeClimb.endDistM + 50;
      displayPoints = items.filter((p) => p.distM >= minDist && p.distM <= maxDist);
      if (displayPoints.length < 2) displayPoints = items;
    }

    // Min e Max de elevação
    const elevations = displayPoints.map((p) => p.elevM);
    let minElev = Math.min(...elevations);
    let maxElev = Math.max(...elevations);

    if (maxElev - minElev < 10) {
      minElev = Math.max(0, minElev - 10);
      maxElev = minElev + 30;
    } else {
      const pad = (maxElev - minElev) * 0.15;
      minElev = Math.max(0, minElev - pad);
      maxElev = maxElev + pad;
    }

    return {
      points: displayPoints,
      minDist,
      maxDist,
      minElev,
      maxElev,
      totalDist: accumDist,
    };
  }, [points, zoomMode, activeClimb]);

  if (!profileData || profileData.points.length < 2) {
    return null;
  }

  const { points: pts, minDist, maxDist, minElev, maxElev, totalDist } = profileData;
  const svgWidth = 400;
  const svgHeight = height;
  const paddingX = 8;
  const paddingTop = 16;
  const paddingBottom = 22;

  const plotWidth = svgWidth - paddingX * 2;
  const plotHeight = svgHeight - paddingTop - paddingBottom;

  const scaleX = (d: number) => {
    const clamped = Math.max(minDist, Math.min(maxDist, d));
    const range = maxDist - minDist || 1;
    return paddingX + ((clamped - minDist) / range) * plotWidth;
  };

  const scaleY = (e: number) => {
    const clamped = Math.max(minElev, Math.min(maxElev, e));
    const range = maxElev - minElev || 1;
    return paddingTop + plotHeight - ((clamped - minElev) / range) * plotHeight;
  };

  // Posição atual do ciclista no SVG
  const riderX = scaleX(currentDistM);
  // Achar elevação correspondente ao ponto atual
  let riderElev = pts[0].elevM;
  for (let i = 0; i < pts.length - 1; i++) {
    if (currentDistM >= pts[i].distM && currentDistM <= pts[i + 1].distM) {
      const t = (currentDistM - pts[i].distM) / (pts[i + 1].distM - pts[i].distM || 1);
      riderElev = pts[i].elevM + t * (pts[i + 1].elevM - pts[i].elevM);
      break;
    }
  }
  const riderY = scaleY(riderElev);

  // Construir polígonos coloridos por segmento de inclinação
  const segmentPolygons: Array<{ path: string; color: string; avgGrade: number }> = [];
  const baseBottom = paddingTop + plotHeight;

  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];

    const x1 = scaleX(p1.distM);
    const y1 = scaleY(p1.elevM);
    const x2 = scaleX(p2.distM);
    const y2 = scaleY(p2.elevM);

    const distDelta = p2.distM - p1.distM;
    const elevDelta = p2.elevM - p1.elevM;
    const grade = distDelta > 0 ? (elevDelta / distDelta) * 100 : 0;
    const color = getGradeColorVar(grade);

    const path = `M ${x1} ${baseBottom} L ${x1} ${y1} L ${x2} ${y2} L ${x2} ${baseBottom} Z`;
    segmentPolygons.push({ path, color, avgGrade: grade });
  }

  // Linha superior do perfil contínuo
  const profileLinePath = pts
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${scaleX(p.distM)} ${scaleY(p.elevM)}`)
    .join(" ");

  return (
    <div
      className={`relative w-full rounded-2xl bg-[var(--color-surface-panel-deep)] border border-[var(--border)] p-3 shadow-xl overflow-hidden ${className}`}
    >
      {/* Header do Perfil */}
      <div className="flex items-center justify-between mb-1.5 px-1">
        <div className="flex items-center gap-2">
          <Mountain size={15} className="text-[var(--accent)]" />
          <span className="text-xs font-bold text-[var(--text)] tracking-wide uppercase">
            {zoomMode === "climb" && activeClimb
              ? `${activeClimb.name} (${activeClimb.category})`
              : t("elevation.profile")}
          </span>
          <span className="text-[10px] text-[var(--color-content-muted)] font-mono">
            {Math.round(minElev)}m - {Math.round(maxElev)}m
          </span>
        </div>

        {showControls && onToggleZoom && activeClimb && (
          <button
            type="button"
            onClick={onToggleZoom}
            className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-[var(--surface-hover)] hover:bg-[var(--surface-raised)] text-[var(--text)] border border-[var(--border)] font-medium transition-colors"
          >
            {zoomMode === "full" ? (
              <>
                <ZoomIn size={12} className="text-[var(--accent)]" />
                <span>{t("elevation.zoom_climb")}</span>
              </>
            ) : (
              <>
                <ZoomOut size={12} className="text-[var(--accent)]" />
                <span>{t("elevation.zoom_route")}</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* SVG Canvas do Perfil */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto block select-none"
          preserveAspectRatio="none"
        >
          <defs>
            {/* Gradiente de fundo sutil */}
            <linearGradient id="gridLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--border)" stopOpacity="0.25" />
              <stop offset="50%" stopColor="var(--muted)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--border)" stopOpacity="0.25" />
            </linearGradient>
          </defs>

          {/* Linhas de grade horizontais de altitude */}
          <line
            x1={paddingX}
            y1={paddingTop}
            x2={svgWidth - paddingX}
            y2={paddingTop}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          <line
            x1={paddingX}
            y1={paddingTop + plotHeight / 2}
            x2={svgWidth - paddingX}
            y2={paddingTop + plotHeight / 2}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          <line
            x1={paddingX}
            y1={baseBottom}
            x2={svgWidth - paddingX}
            y2={baseBottom}
            stroke="var(--border)"
          />

          {/* Polígonos coloridos com as cores de inclinação */}
          {segmentPolygons.map((seg, idx) => (
            <path
              key={idx}
              d={seg.path}
              fill={seg.color}
              fillOpacity={0.7}
              stroke="none"
            />
          ))}

          {/* Linha de contorno superior */}
          <path
            d={profileLinePath}
            fill="none"
            stroke="var(--text)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Marcadores de início/fim de subidas categorizadas */}
          {zoomMode === "full" &&
            climbs.map((climb) => {
              if (climb.startDistM < minDist || climb.endDistM > maxDist) return null;
              const startX = scaleX(climb.startDistM);
              const endX = scaleX(climb.endDistM);
              const badgeStyle = getCategoryBadgeStyle(climb.category);

              return (
                <g key={climb.id}>
                  {/* Área sombreada da subida */}
                  <rect
                    x={startX}
                    y={paddingTop}
                    width={Math.max(2, endX - startX)}
                    height={plotHeight}
                    fill={badgeStyle.badgeBg}
                    fillOpacity={0.12}
                  />
                  {/* Linha vertical de início */}
                  <line
                    x1={startX}
                    y1={paddingTop}
                    x2={startX}
                    y2={baseBottom}
                    stroke={badgeStyle.badgeBg}
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                  {/* Tag da categoria */}
                  <rect
                    x={Math.max(paddingX, startX - 14)}
                    y={paddingTop - 12}
                    width={28}
                    height={12}
                    rx={3}
                    fill={badgeStyle.badgeBg}
                  />
                  <text
                    x={Math.max(paddingX, startX - 14) + 14}
                    y={paddingTop - 3}
                    fill={badgeStyle.badgeText}
                    fontSize="7.5"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {badgeStyle.label}
                  </text>
                </g>
              );
            })}

          {/* Marcador do Ciclista em Movimento */}
          {currentDistM >= minDist && currentDistM <= maxDist && (
            <g>
              {/* Linha guia vertical */}
              <line
                x1={riderX}
                y1={paddingTop}
                x2={riderX}
                y2={baseBottom}
                stroke="var(--color-chart-elevation)"
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
              {/* Anel pulsante */}
              <circle
                cx={riderX}
                cy={riderY}
                r={8}
                fill="none"
                stroke="var(--color-chart-elevation)"
                strokeWidth="2"
                opacity={0.6}
              />
              {/* Ponto central */}
              <circle
                cx={riderX}
                cy={riderY}
                r={4.5}
                fill="var(--color-chart-elevation)"
                stroke="var(--text)"
                strokeWidth="1.5"
              />
            </g>
          )}

          {/* Eixo de distâncias */}
          <text
            x={paddingX}
            y={svgHeight - 4}
            fill="var(--muted)"
            fontSize="8.5"
            fontFamily="monospace"
          >
            {formatDistance(minDist)}
          </text>
          <text
            x={svgWidth / 2}
            y={svgHeight - 4}
            fill="var(--muted)"
            fontSize="8.5"
            fontFamily="monospace"
            textAnchor="middle"
          >
            {formatDistance((minDist + maxDist) / 2)}
          </text>
          <text
            x={svgWidth - paddingX}
            y={svgHeight - 4}
            fill="var(--muted)"
            fontSize="8.5"
            fontFamily="monospace"
            textAnchor="end"
          >
            {formatDistance(maxDist)}
          </text>
        </svg>
      </div>

      {/* Legenda rápida de gradiente */}
      <div className="flex items-center justify-between text-[10px] text-[var(--color-content-muted)] mt-1 px-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--color-palette-emerald-500)]" /> &lt;3%
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--color-palette-yellow-400)]" /> 3-6%
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--color-palette-orange-500)]" /> 6-9%
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--color-status-danger)]" /> 9-12%
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--color-palette-purple-500)]" /> &gt;12%
          </span>
        </div>
        <div className="font-mono text-[var(--color-content-muted)]">
          {t("elevation.current_altitude")}: <strong className="text-[var(--accent)]">{Math.round(riderElev)}m</strong>
        </div>
      </div>
    </div>
  );
}
