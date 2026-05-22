"use client";

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
}

const PAD = { top: 12, right: 8, bottom: 28, left: 44 };

export function SimpleLineChart({
  data,
  height = 160,
  color = "#ff6b35",
  yLabel,
  xLabel,
  formatY = (v) => String(Math.round(v)),
  invertY = false,
  fillArea = true,
}: SimpleLineChartProps) {
  const { t } = useI18n();
  const width = 400;
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  if (data.length < 2) {
    return (
      <p className="text-sm text-[var(--muted)] text-center py-8">
        {t("charts.insufficient_data")}
      </p>
    );
  }

  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
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
    const t = (y - minY) / (maxY - minY || 1);
    const norm = invertY ? t : 1 - t;
    return PAD.top + norm * innerH;
  };

  const linePoints = data.map((d) => `${scaleX(d.x)},${scaleY(d.y)}`).join(" ");
  const areaPoints = `${scaleX(data[0].x)},${scaleY(minY)} ${linePoints} ${scaleX(data[data.length - 1].x)},${scaleY(minY)}`;

  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks }, (_, i) => {
    const t = i / (yTicks - 1);
    return invertY
      ? minY + (maxY - minY) * t
      : maxY - (maxY - minY) * t;
  });

  const xTicks = Math.min(5, data.length);
  const xTickIndices = Array.from({ length: xTicks }, (_, i) =>
    Math.round((i / (xTicks - 1 || 1)) * (data.length - 1))
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      role="img"
      aria-label={yLabel ?? t("charts.graph")}
    >
      {yTickValues.map((v, i) => {
        const y = scaleY(invertY ? v : v);
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
              y={y + 4}
              textAnchor="end"
              fill="var(--muted)"
              fontSize={10}
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
        strokeWidth={2.5}
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
            fontSize={10}
          >
            {d.label ?? (Number.isInteger(d.x) ? d.x : d.x.toFixed(1))}
          </text>
        );
      })}

      {xLabel && (
        <text
          x={width / 2}
          y={height - 2}
          textAnchor="middle"
          fill="var(--muted)"
          fontSize={9}
        >
          {xLabel}
        </text>
      )}
    </svg>
  );
}
