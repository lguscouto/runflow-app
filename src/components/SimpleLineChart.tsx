"use client";

import React, { useRef, useCallback, memo } from "react";
import type { ChartPoint } from "@/lib/chart-data";
import { useI18n } from "@/lib/i18n";


interface SimpleLineChartProps {
  data: ChartPoint[];
  height?: number;
  color?: string;
  yLabel?: string;
  xLabel?: string;
  formatY?: (v: number) => string;
  invertY?: boolean;
  fillArea?: boolean;
  hoverX?: number | null;
  onHoverX?: (x: number | null) => void;
  unit?: string;
}

const PAD = { top: 14, right: 12, bottom: 28, left: 44 };

export const SimpleLineChart = memo(function SimpleLineChart({
  data,
  height = 160,
  color = "var(--color-chart-pace)",
  yLabel,
  xLabel,
  formatY = (v) => String(Math.round(v)),
  invertY = false,
  fillArea = true,
  hoverX,
  onHoverX,
  unit,
}: SimpleLineChartProps) {
  const { t } = useI18n();
  const svgRef = useRef<SVGSVGElement>(null);
  const width = 400;
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  const xs = data && data.length > 0 ? data.map((d) => d.x) : [0];
  const ys = data && data.length > 0 ? data.map((d) => d.y) : [0];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);

  // Handle pointer tracking (hooks must be at the top)
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!onHoverX || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const normX = (clientX / rect.width) * width;
      const clampedX = Math.max(PAD.left, Math.min(width - PAD.right, normX));
      const valX = minX + ((clampedX - PAD.left) / (innerW || 1)) * (maxX - minX);
      onHoverX(valX);
    },
    [onHoverX, minX, maxX, innerW, width]
  );

  const handlePointerLeave = useCallback(() => {
    if (onHoverX) onHoverX(null);
  }, [onHoverX]);

  if (!data || data.length < 2) {
    return (
      <p className="text-sm text-[var(--muted)] text-center py-8">
        {t("charts.insufficient_data")}
      </p>
    );
  }

  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);

  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }

  const padY = (maxY - minY) * 0.08;
  minY -= padY;
  maxY += padY;

  const scaleX = (x: number) =>
    PAD.left + ((x - minX) / (maxX - minX || 1)) * innerW;
  const scaleY = (y: number) => {
    const tNorm = (y - minY) / (maxY - minY || 1);
    const norm = invertY ? tNorm : 1 - tNorm;
    return PAD.top + norm * innerH;
  };

  const linePoints = data.map((d) => `${scaleX(d.x)},${scaleY(d.y)}`).join(" ");
  const areaPoints = `${scaleX(data[0].x)},${scaleY(minY)} ${linePoints} ${scaleX(
    data[data.length - 1].x
  )},${scaleY(minY)}`;

  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks }, (_, i) => {
    const tVal = i / (yTicks - 1);
    return invertY ? minY + (maxY - minY) * tVal : maxY - (maxY - minY) * tVal;
  });

  const xTicks = Math.min(5, data.length);
  const xTickIndices = Array.from({ length: xTicks }, (_, i) =>
    Math.round((i / (xTicks - 1 || 1)) * (data.length - 1))
  );

  // Find closest point to hovered X
  let hoveredPoint: ChartPoint | null = null;
  if (hoverX != null && Number.isFinite(hoverX)) {
    let closestDist = Infinity;
    for (const d of data) {
      const dist = Math.abs(d.x - hoverX);
      if (dist < closestDist) {
        closestDist = dist;
        hoveredPoint = d;
      }
    }
  }

  return (
    <div className="relative select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto cursor-crosshair touch-none"
        role="img"
        aria-label={yLabel ?? t("charts.graph")}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerLeave}
      >
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
                x={PAD.left - 6}
                y={y + 3.5}
                textAnchor="end"
                fill="var(--muted)"
                fontSize={9.5}
                fontFamily="monospace"
              >
                {formatY(v)}
              </text>
            </g>
          );
        })}

        {fillArea && (
          <polygon points={areaPoints} fill={color} fillOpacity={0.12} />
        )}
        <polyline
          points={linePoints}
          fill="none"
          stroke={color}
          strokeWidth={2.2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {xTickIndices.map((idx) => {
          const d = data[idx];
          const x = scaleX(d.x);
          return (
            <text
              key={idx}
              x={x}
              y={height - 8}
              textAnchor="middle"
              fill="var(--muted)"
              fontSize={9.5}
              fontFamily="monospace"
            >
              {d.label ?? (Number.isInteger(d.x) ? d.x : d.x.toFixed(1))}
            </text>
          );
        })}

        {/* Synchronized Crosshair Cursor */}
        {hoveredPoint && (
          <g className="pointer-events-none transition-all">
            {/* Vertical crosshair line */}
            <line
              x1={scaleX(hoveredPoint.x)}
              y1={PAD.top - 4}
              x2={scaleX(hoveredPoint.x)}
              y2={height - PAD.bottom + 2}
              stroke="var(--color-chart-crosshair)"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              strokeOpacity={0.7}
            />

            {/* Dot on line */}
            <circle
              cx={scaleX(hoveredPoint.x)}
              cy={scaleY(hoveredPoint.y)}
              r={5}
              fill={color}
              stroke="var(--color-chart-crosshair)"
              strokeWidth={2}
            />

            {/* Tooltip Tag */}
            <g
              transform={`translate(${Math.max(
                PAD.left + 30,
                Math.min(width - PAD.right - 30, scaleX(hoveredPoint.x))
              )}, ${PAD.top - 2})`}
            >
              <rect
                x={-32}
                y={-12}
                width={64}
                height={16}
                rx={4}
                fill="var(--color-surface-chart)"
                stroke="var(--border)"
                strokeOpacity={0.3}
                strokeWidth={1}
              />
              <text
                x={0}
                y={0}
                textAnchor="middle"
                fill="var(--text)"
                fontSize={9.5}
                fontWeight="bold"
                fontFamily="monospace"
              >
                {formatY(hoveredPoint.y)}
              </text>
            </g>
          </g>
        )}

        {xLabel && (
          <text
            x={width / 2}
            y={height - 2}
            textAnchor="middle"
            fill="var(--muted)"
            fontSize={8.5}
          >
            {xLabel}
          </text>
        )}
      </svg>
    </div>
  );
});
