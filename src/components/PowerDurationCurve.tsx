"use client";

import React, { useMemo, useState } from "react";
import { Zap, Flame, Trophy, Activity, Info, Sparkles, TrendingUp } from "lucide-react";
import type { ActivityDetail, UserProfile } from "@/lib/types";
import { calculateActivityPowerCurve, PeakPowerEffort } from "@/lib/power-curve";
import { formatWatts } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

interface PowerDurationCurveProps {
  activity: ActivityDetail;
  userProfile?: UserProfile | null;
}

export function PowerDurationCurve({ activity, userProfile }: PowerDurationCurveProps) {
  const { t } = useI18n();
  const [hoveredEffort, setHoveredEffort] = useState<PeakPowerEffort | null>(null);

  const ftpWatts = userProfile?.cyclingFtpWatts;
  const weightKg = userProfile?.weightKg;

  const analysis = useMemo(() => {
    return calculateActivityPowerCurve(activity, ftpWatts, weightKg);
  }, [activity, ftpWatts, weightKg]);

  if (!analysis.hasPower || analysis.points.length === 0) {
    return null;
  }

  // SVG Chart Dimensions
  const width = 500;
  const height = 180;
  const pad = { top: 15, right: 15, bottom: 30, left: 45 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const points = analysis.points;
  const maxW = Math.max(100, Math.ceil((analysis.maxWatts * 1.1) / 50) * 50);
  const minW = 0;

  // Log scale for X axis durations
  const minLog = Math.log10(5);
  const maxLog = Math.log10(Math.max(3600, points[points.length - 1].durationSec));

  const scaleX = (sec: number) => {
    const l = Math.log10(Math.max(5, sec));
    return pad.left + ((l - minLog) / (maxLog - minLog || 1)) * innerW;
  };

  const scaleY = (watts: number) => {
    const norm = (watts - minW) / (maxW - minW || 1);
    return pad.top + (1 - norm) * innerH;
  };

  const linePoints = points.map((p) => `${scaleX(p.durationSec)},${scaleY(p.watts)}`).join(" ");
  const areaPoints = `${scaleX(points[0].durationSec)},${scaleY(0)} ${linePoints} ${scaleX(
    points[points.length - 1].durationSec
  )},${scaleY(0)}`;

  const yTicks = [0, Math.round(maxW * 0.33), Math.round(maxW * 0.66), maxW];

  return (
    <section className="stat-card space-y-5 border-[var(--border)] bg-[var(--surface)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
            <Zap size={20} className="fill-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--text)] flex items-center gap-2">
              <span>{t("power_curve.title")}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                MMP / Potência Crítica
              </span>
            </h2>
            <p className="text-xs text-[var(--muted)]">{t("power_curve.subtitle")}</p>
          </div>
        </div>

        {/* FTP & W/kg context */}
        {ftpWatts && (
          <div className="flex items-center gap-2 text-xs font-semibold">
            <div className="px-2.5 py-1 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center gap-1.5">
              <span className="text-[var(--muted)]">FTP:</span>
              <span className="text-amber-400 font-bold font-mono">{ftpWatts} W</span>
            </div>
            {weightKg && (
              <div className="px-2.5 py-1 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center gap-1.5">
                <span className="text-[var(--muted)]">Peso:</span>
                <span className="text-cyan-400 font-bold font-mono">{weightKg} kg</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Peak Power Best Efforts Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-[var(--muted)]">
          <span className="font-semibold flex items-center gap-1.5">
            <Trophy size={13} className="text-amber-400" />
            {t("power_curve.peak_efforts_title")}
          </span>
          <span className="text-[11px]">Intervalos contínuos de maior média</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {analysis.peakEfforts.map((effort) => {
            const isHovered = hoveredEffort?.key === effort.key;
            return (
              <div
                key={effort.key}
                onMouseEnter={() => setHoveredEffort(effort)}
                onMouseLeave={() => setHoveredEffort(null)}
                className={`p-2.5 rounded-xl border transition-all cursor-default ${
                  isHovered
                    ? "bg-amber-500/10 border-amber-500/50 shadow-md ring-1 ring-amber-500/30"
                    : "bg-[var(--bg)] border-[var(--border)] hover:border-amber-500/30"
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                    {effort.label}
                  </span>
                  {effort.percentFtp && (
                    <span className="text-[10px] font-bold text-amber-400 font-mono">
                      {effort.percentFtp}% FTP
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1 my-0.5">
                  <span className="text-lg font-black text-white font-mono tracking-tight">
                    {effort.watts}
                  </span>
                  <span className="text-[10px] text-[var(--muted)]">W</span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-[var(--muted)] font-mono">
                  {effort.wattsPerKg ? (
                    <span className="text-cyan-300 font-semibold">{effort.wattsPerKg} W/kg</span>
                  ) : (
                    <span>{t(effort.nameKey)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SVG Power-Duration Curve Chart */}
      <div className="p-3 rounded-2xl bg-[#0a0e17] border border-[var(--border)] space-y-2">
        <div className="flex items-center justify-between text-xs text-[var(--muted)] px-1">
          <span className="font-semibold text-white flex items-center gap-1.5">
            <Activity size={13} className="text-amber-400" />
            Curva de Potência vs Duração (Segundos / Minutos)
          </span>
          {hoveredEffort && (
            <span className="text-amber-300 font-mono font-bold animate-fadeIn">
              Pico {hoveredEffort.label}: {hoveredEffort.watts} W ({hoveredEffort.wattsPerKg ? `${hoveredEffort.wattsPerKg} W/kg` : ""})
            </span>
          )}
        </div>

        <div className="w-full overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[320px]">
            <defs>
              <linearGradient id="powerCurveGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {yTicks.map((w, idx) => {
              const y = scaleY(w);
              return (
                <g key={idx}>
                  <line
                    x1={pad.left}
                    y1={y}
                    x2={width - pad.right}
                    y2={y}
                    stroke="var(--border)"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={pad.left - 6}
                    y={y + 3.5}
                    textAnchor="end"
                    fill="var(--muted)"
                    fontSize={9}
                    fontFamily="monospace"
                  >
                    {w} W
                  </text>
                </g>
              );
            })}

            {/* FTP Line if set */}
            {ftpWatts && ftpWatts <= maxW && (
              <g>
                <line
                  x1={pad.left}
                  y1={scaleY(ftpWatts)}
                  x2={width - pad.right}
                  y2={scaleY(ftpWatts)}
                  stroke="#38bdf8"
                  strokeWidth={1.2}
                  strokeDasharray="3 3"
                />
                <text
                  x={width - pad.right - 4}
                  y={scaleY(ftpWatts) - 4}
                  textAnchor="end"
                  fill="#38bdf8"
                  fontSize={8.5}
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  FTP ({ftpWatts}W)
                </text>
              </g>
            )}

            {/* Area Fill & Curve Line */}
            <polygon points={areaPoints} fill="url(#powerCurveGrad)" />
            <polyline
              points={linePoints}
              fill="none"
              stroke="#f59e0b"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Peak Effort Highlight Circles */}
            {points.map((p) => {
              const cx = scaleX(p.durationSec);
              const cy = scaleY(p.watts);
              const isHovered = hoveredEffort?.durationSec === p.durationSec;
              return (
                <g
                  key={p.durationSec}
                  className="cursor-pointer group"
                  onMouseEnter={() => {
                    const match = analysis.peakEfforts.find((e) => e.durationSec === p.durationSec);
                    if (match) setHoveredEffort(match);
                  }}
                  onMouseLeave={() => setHoveredEffort(null)}
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 6 : 3.5}
                    fill={isHovered ? "#fbbf24" : "#f59e0b"}
                    stroke="#0a0e17"
                    strokeWidth={2}
                    className="transition-all"
                  />
                  {isHovered && (
                    <text
                      x={cx}
                      y={cy - 10}
                      textAnchor="middle"
                      fill="#fef08a"
                      fontSize={10}
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {p.watts}W
                    </text>
                  )}
                </g>
              );
            })}

            {/* X Axis Labels */}
            {points.map((p) => {
              const x = scaleX(p.durationSec);
              return (
                <text
                  key={p.durationSec}
                  x={x}
                  y={height - 10}
                  textAnchor="middle"
                  fill="var(--muted)"
                  fontSize={9}
                  fontFamily="monospace"
                >
                  {p.label}
                </text>
              );
            })}
          </svg>
        </div>
      </div>
    </section>
  );
}
