"use client";

import React, { useState } from "react";
import type { ChartBarData } from "@/lib/stats";
import { useI18n } from "@/lib/i18n";

interface VolumeBarChartProps {
  data: ChartBarData[];
  valueKey: "distanceKm" | "durationMin";
  height?: number;
}

const PAD = { top: 32, right: 16, bottom: 32, left: 48 };

export function VolumeBarChart({
  data,
  valueKey,
  height = 180,
}: VolumeBarChartProps) {
  const { t } = useI18n();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const width = 500;
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-[var(--muted)]">
        {t("stats.no_activities")}
      </div>
    );
  }

  const values = data.map((d) => d[valueKey]);
  const maxVal = Math.max(...values, 1);

  // Y-axis ticks
  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks }, (_, i) => {
    return (maxVal / (yTicks - 1)) * (yTicks - 1 - i);
  });

  const scaleY = (val: number) => {
    return PAD.top + innerH - (val / maxVal) * innerH;
  };

  const slotW = innerW / data.length;
  const barW = Math.min(28, slotW * 0.65);

  const formatVal = (val: number) => {
    if (valueKey === "distanceKm") {
      return `${val.toFixed(1)} km`;
    } else {
      const h = Math.floor(val / 60);
      const m = val % 60;
      if (h > 0) {
        return m > 0 ? `${h}h${m}m` : `${h}h`;
      }
      return `${val}m`;
    }
  };

  // Determine x ticks to show
  // If data.length is large (like 12), show fewer labels so they don't overlap
  const xLabelInterval = data.length > 8 ? 2 : 1;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto select-none"
        role="img"
        aria-label={valueKey === "distanceKm" ? "Volume de Distância" : "Volume de Tempo"}
      >
        <defs>
          <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="bar-grad-hover" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTickValues.map((v, i) => {
          const y = scaleY(v);
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                y1={y}
                x2={width - PAD.right}
                y2={y}
                stroke="var(--border)"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={PAD.left - 8}
                y={y + 3}
                textAnchor="end"
                fill="var(--muted)"
                fontSize={9}
                className="font-mono font-medium"
              >
                {valueKey === "distanceKm" ? v.toFixed(0) : formatVal(v)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const val = d[valueKey];
          const xCenter = PAD.left + i * slotW + slotW / 2;
          const x = xCenter - barW / 2;
          const y = scaleY(val);
          const barH = Math.max(2, innerH - (y - PAD.top)); // Min height of 2px for visual visibility

          const isHovered = hoveredIdx === i;
          const isAnyHovered = hoveredIdx !== null;

          return (
            <g
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              {/* Invisible interactive overlay to make hovering easier */}
              <rect
                x={PAD.left + i * slotW}
                y={PAD.top}
                width={slotW}
                height={innerH}
                fill="transparent"
              />

              {/* The actual visual bar */}
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                fill={isHovered ? "url(#bar-grad-hover)" : "url(#bar-grad)"}
                rx={4}
                ry={4}
                className="transition-all duration-200"
                opacity={!isAnyHovered || isHovered ? 1 : 0.4}
              />

              {/* Tooltip value shown above the bar on hover */}
              {isHovered && val > 0 && (
                <g>
                  {/* Tooltip background */}
                  <rect
                    x={xCenter - 35}
                    y={y - 25}
                    width={70}
                    height={18}
                    rx={4}
                    fill="var(--surface)"
                    stroke="var(--accent)"
                    strokeWidth={1}
                  />
                  <text
                    x={xCenter}
                    y={y - 13}
                    textAnchor="middle"
                    fill="var(--text)"
                    fontSize={9}
                    className="font-semibold"
                  >
                    {formatVal(val)}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* X Axis Labels */}
        {data.map((d, i) => {
          if (i % xLabelInterval !== 0) return null;
          const xCenter = PAD.left + i * slotW + slotW / 2;
          return (
            <text
              key={i}
              x={xCenter}
              y={height - 10}
              textAnchor="middle"
              fill="var(--muted)"
              fontSize={9}
              className="font-medium"
            >
              {d.label}
            </text>
          );
        })}
      </svg>
      {/* Bottom status text with hovered item detail */}
      <div className="h-4 mt-1 text-center text-xs text-[var(--muted)] font-medium">
        {hoveredIdx !== null ? data[hoveredIdx].fullLabel : "\u00A0"}
      </div>
    </div>
  );
}
