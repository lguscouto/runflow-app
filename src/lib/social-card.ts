import type { ActivityDetail, TrackPoint } from "./types";
import { colorTokens } from "./color-tokens";
import {
  formatDistance,
  formatDuration,
  formatPace,
  formatSpeed,
  formatSportSpeedOrPace,
  formatElevation,
  formatCalories,
  formatWatts,
  formatDate,
  sportLabel,
} from "./format";

export type CardFormat = "stories" | "feed";
export type CardTheme = "cyberpunk" | "minimal" | "sunset" | "topo" | "peloton" | "custom";

export interface CardRenderOptions {
  format: CardFormat;
  theme: CardTheme;
  customImage?: HTMLImageElement | null;
  showMap: boolean;
  showStats: boolean;
  showSecondaryStats: boolean;
  showPrBadge: boolean;
  prBadgeText?: string | null;
  showBranding: boolean;
  language: "pt" | "en";
}

interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

function getTrackBounds(points: TrackPoint[]): Bounds | null {
  if (points.length === 0) return null;
  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;

  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  return { minLat, maxLat, minLng, maxLng };
}

export function drawTrackPolyline(
  ctx: CanvasRenderingContext2D,
  points: TrackPoint[],
  x: number,
  y: number,
  width: number,
  height: number,
  strokeColor: string | CanvasGradient,
  lineWidth: number = 8,
  glowColor?: string
) {
  if (points.length < 2) return;
  const bounds = getTrackBounds(points);
  if (!bounds) return;

  const latSpan = bounds.maxLat - bounds.minLat || 0.0001;
  const lngSpan = bounds.maxLng - bounds.minLng || 0.0001;

  const midLat = (bounds.minLat + bounds.maxLat) / 2;
  const cosLat = Math.cos((midLat * Math.PI) / 180);
  const geoAspect = (lngSpan * cosLat) / latSpan;

  let drawW = width;
  let drawH = height;
  const boxAspect = width / height;

  if (geoAspect > boxAspect) {
    drawH = width / geoAspect;
  } else {
    drawW = height * geoAspect;
  }

  const offsetX = x + (width - drawW) / 2;
  const offsetY = y + (height - drawH) / 2;

  const project = (p: TrackPoint) => {
    const normX = (p.lng - bounds.minLng) / lngSpan;
    const normY = 1 - (p.lat - bounds.minLat) / latSpan;
    return {
      px: offsetX + normX * drawW,
      py: offsetY + normY * drawH,
    };
  };

  if (glowColor) {
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 24;
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = lineWidth + 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    points.forEach((p, idx) => {
      const { px, py } = project(p);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  points.forEach((p, idx) => {
    const { px, py } = project(p);
    if (idx === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  const startPt = project(points[0]);
  ctx.fillStyle = colorTokens.brand.success;
  ctx.shadowColor = colorTokens.brand.success;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(startPt.px, startPt.py, lineWidth * 1.4, 0, Math.PI * 2);
  ctx.fill();

  const endPt = project(points[points.length - 1]);
  ctx.fillStyle = colorTokens.brand.accent;
  ctx.shadowColor = colorTokens.brand.accent;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(endPt.px, endPt.py, lineWidth * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colorTokens.content.inverse;
  ctx.beginPath();
  ctx.arc(endPt.px, endPt.py, lineWidth * 0.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function renderSocialCard(
  canvas: HTMLCanvasElement,
  activity: ActivityDetail,
  options: CardRenderOptions
): void {
  const isStories = options.format === "stories";
  const width = 1080;
  const height = isStories ? 1920 : 1080;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // 1. Draw Background
  drawBackground(ctx, width, height, options);

  // Layout Parameters
  const padX = 70;
  let cursorY = isStories ? 130 : 70;
  const contentWidth = width - padX * 2;

  // 2. Branding (Top Right)
  if (options.showBranding) {
    drawBranding(ctx, width - padX - 210, cursorY);
  }

  // 3. Header: Title & Sport / Date
  drawHeaderInfo(ctx, activity, options, padX, cursorY, contentWidth - (options.showBranding ? 230 : 0));
  cursorY += isStories ? 170 : 130;

  // 4. Map Container (if enabled and points exist)
  if (options.showMap && activity.points.length >= 2) {
    const mapHeight = isStories ? 860 : 460;
    drawMapContainer(ctx, activity.points, options, padX, cursorY, contentWidth, mapHeight);
    cursorY += mapHeight + (isStories ? 60 : 35);
  } else {
    cursorY += isStories ? 180 : 70;
  }

  // 5. Primary Stats (Distance, Time, Pace/Speed)
  if (options.showStats) {
    drawPrimaryStats(ctx, activity, options, padX, cursorY, contentWidth);
    cursorY += isStories ? 180 : 140;
  }

  // 6. Secondary Stats (Elevation, Power, Cadence, Max Speed, HR, Calories)
  if (options.showSecondaryStats) {
    drawSecondaryStats(ctx, activity, options, padX, cursorY, contentWidth);
    cursorY += isStories ? 130 : 90;
  }

  // 7. Footer / PR Badge
  drawFooter(ctx, options, padX, height - (isStories ? 90 : 50), contentWidth);
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: CardRenderOptions
) {
  if (options.theme === "custom" && options.customImage) {
    const img = options.customImage;
    const imgAspect = img.width / img.height;
    const canvasAspect = width / height;
    let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;

    if (imgAspect > canvasAspect) {
      sWidth = img.height * canvasAspect;
      sx = (img.width - sWidth) / 2;
    } else {
      sHeight = img.width / canvasAspect;
      sy = (img.height - sHeight) / 2;
    }

    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height);

    // Dark gradient overlay for legibility
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, colorTokens.socialCard.customOverlay[0]);
    grad.addColorStop(0.35, colorTokens.socialCard.customOverlay[1]);
    grad.addColorStop(0.7, colorTokens.socialCard.customOverlay[2]);
    grad.addColorStop(1, colorTokens.socialCard.customOverlay[3]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  if (options.theme === "peloton") {
    // Carbon Dark Cycling Tech Background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, colorTokens.socialCard.peloton.background[0]);
    bgGrad.addColorStop(0.5, colorTokens.socialCard.peloton.background[1]);
    bgGrad.addColorStop(1, colorTokens.socialCard.peloton.background[2]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle carbon grid
    ctx.strokeStyle = colorTokens.socialCard.peloton.grid;
    ctx.lineWidth = 1.5;
    const step = 60;
    for (let x = 0; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Amber and Cyan radial glows
    const rad1 = ctx.createRadialGradient(width * 0.85, height * 0.25, 40, width * 0.85, height * 0.25, 550);
    rad1.addColorStop(0, colorTokens.socialCard.peloton.amberGlow);
    rad1.addColorStop(1, "transparent");
    ctx.fillStyle = rad1;
    ctx.fillRect(0, 0, width, height);

    const rad2 = ctx.createRadialGradient(width * 0.15, height * 0.8, 40, width * 0.15, height * 0.8, 550);
    rad2.addColorStop(0, colorTokens.socialCard.peloton.cyanGlow);
    rad2.addColorStop(1, "transparent");
    ctx.fillStyle = rad2;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  if (options.theme === "cyberpunk") {
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, colorTokens.socialCard.cyberpunk.background[0]);
    bgGrad.addColorStop(0.5, colorTokens.socialCard.cyberpunk.background[1]);
    bgGrad.addColorStop(1, colorTokens.socialCard.cyberpunk.background[2]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const radial1 = ctx.createRadialGradient(width * 0.8, height * 0.3, 50, width * 0.8, height * 0.3, 600);
    radial1.addColorStop(0, colorTokens.socialCard.cyberpunk.cyanGlow);
    radial1.addColorStop(1, "transparent");
    ctx.fillStyle = radial1;
    ctx.fillRect(0, 0, width, height);

    const radial2 = ctx.createRadialGradient(width * 0.2, height * 0.7, 50, width * 0.2, height * 0.7, 600);
    radial2.addColorStop(0, colorTokens.socialCard.cyberpunk.pinkGlow);
    radial2.addColorStop(1, "transparent");
    ctx.fillStyle = radial2;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  if (options.theme === "sunset") {
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, colorTokens.socialCard.sunset.background[0]);
    bgGrad.addColorStop(0.4, colorTokens.socialCard.sunset.background[1]);
    bgGrad.addColorStop(0.75, colorTokens.socialCard.sunset.background[2]);
    bgGrad.addColorStop(1, colorTokens.socialCard.sunset.background[3]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = colorTokens.socialCard.sunset.overlay;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  if (options.theme === "topo") {
    ctx.fillStyle = colorTokens.socialCard.topo.background;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = colorTokens.socialCard.topo.grid;
    ctx.lineWidth = 2;
    const step = 80;
    for (let x = 0; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    return;
  }

  // Default: Minimalist Dark
  const minGrad = ctx.createLinearGradient(0, 0, 0, height);
  minGrad.addColorStop(0, colorTokens.socialCard.minimal.background[0]);
  minGrad.addColorStop(1, colorTokens.socialCard.minimal.background[1]);
  ctx.fillStyle = minGrad;
  ctx.fillRect(0, 0, width, height);
}

function drawBranding(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.fillStyle = colorTokens.socialCard.branding.background;
  ctx.strokeStyle = colorTokens.socialCard.branding.border;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y - 40, 210, 60, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = colorTokens.brand.accent;
  roundRect(ctx, x + 10, y - 30, 40, 40, 10);
  ctx.fill();

  ctx.fillStyle = colorTokens.content.inverse;
  ctx.font = "bold 20px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("RF", x + 30, y - 10);

  ctx.fillStyle = colorTokens.content.primary;
  ctx.font = "bold 24px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("RunFlow", x + 62, y - 10);
  ctx.restore();
}

function drawHeaderInfo(
  ctx: CanvasRenderingContext2D,
  activity: ActivityDetail,
  options: CardRenderOptions,
  x: number,
  y: number,
  maxWidth: number
) {
  ctx.save();

  ctx.fillStyle = colorTokens.content.inverse;
  ctx.font = "bold 54px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const isCycling = activity.sport === "cycling";
  let defaultName = isCycling
    ? options.language === "pt"
      ? "Pedal com RunFlow"
      : "Cycling Ride"
    : options.language === "pt"
    ? "Treino de Corrida"
    : "Running Workout";

  let name = activity.name || defaultName;
  if (ctx.measureText(name).width > maxWidth) {
    while (name.length > 4 && ctx.measureText(name + "...").width > maxWidth) {
      name = name.slice(0, -1);
    }
    name += "...";
  }
  ctx.fillText(name, x, y);

  const sportIcon = isCycling ? "🚴" : "🏃";
  const sport = sportLabel(activity.sport, options.language);
  const dateStr = formatDate(activity.startedAt, options.language);
  const subText = `${sportIcon} ${sport}  ·  ${dateStr}`;

  ctx.fillStyle = isCycling ? colorTokens.socialCard.header.cycling : colorTokens.socialCard.header.running;
  ctx.font = "500 28px system-ui, sans-serif";
  ctx.fillText(subText, x, y + 74);

  ctx.restore();
}

function drawMapContainer(
  ctx: CanvasRenderingContext2D,
  points: TrackPoint[],
  options: CardRenderOptions,
  x: number,
  y: number,
  width: number,
  height: number
) {
  ctx.save();

  ctx.fillStyle = colorTokens.socialCard.map.background;
  ctx.strokeStyle = colorTokens.socialCard.map.border;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, width, height, 32);
  ctx.fill();
  ctx.stroke();

  let strokeColor: string | CanvasGradient = colorTokens.brand.accent;
  let glowColor: string | undefined = colorTokens.socialCard.branding.border;

  if (options.theme === "peloton") {
    const grad = ctx.createLinearGradient(x, y, x + width, y + height);
    grad.addColorStop(0, colorTokens.chart.power);
    grad.addColorStop(0.65, colorTokens.chart.cadence);
    grad.addColorStop(1, colorTokens.map.route);
    strokeColor = grad;
    glowColor = colorTokens.socialCard.peloton.trackGlow;
  } else if (options.theme === "cyberpunk") {
    const grad = ctx.createLinearGradient(x, y, x + width, y + height);
    grad.addColorStop(0, colorTokens.heatmap.cyan.core);
    grad.addColorStop(0.5, colorTokens.heatmap.sunset.core);
    grad.addColorStop(1, colorTokens.brand.accent);
    strokeColor = grad;
    glowColor = colorTokens.socialCard.cyberpunk.trackGlow;
  } else if (options.theme === "sunset") {
    strokeColor = colorTokens.content.inverse;
    glowColor = colorTokens.socialCard.sunset.trackGlow;
  } else if (options.theme === "topo") {
    strokeColor = colorTokens.brand.success;
    glowColor = colorTokens.socialCard.topo.trackGlow;
  } else if (options.theme === "minimal") {
    strokeColor = colorTokens.brand.accent;
    glowColor = colorTokens.socialCard.minimal.trackGlow;
  }

  const innerPad = 48;
  drawTrackPolyline(
    ctx,
    points,
    x + innerPad,
    y + innerPad,
    width - innerPad * 2,
    height - innerPad * 2,
    strokeColor,
    9,
    glowColor
  );

  ctx.restore();
}

function drawPrimaryStats(
  ctx: CanvasRenderingContext2D,
  activity: ActivityDetail,
  options: CardRenderOptions,
  x: number,
  y: number,
  width: number
) {
  ctx.save();

  const isCycling = activity.sport === "cycling";
  const colWidth = width / 3;
  const labels =
    options.language === "pt"
      ? { dist: "DISTÂNCIA", dur: "TEMPO", pace: isCycling ? "VELOCIDADE MÉDIA" : "RITMO MÉDIO" }
      : { dist: "DISTANCE", dur: "TIME", pace: isCycling ? "AVG SPEED" : "AVG PACE" };

  const values = {
    dist: formatDistance(activity.distanceM),
    dur: formatDuration(activity.durationSec),
    pace: formatSportSpeedOrPace(activity.sport, activity.avgPaceSecKm, activity.avgSpeedKmh),
  };

  const distColor = isCycling ? colorTokens.chart.power : colorTokens.brand.accent;
  const paceColor = isCycling ? colorTokens.chart.cadence : colorTokens.brand.success;

  drawSingleStat(ctx, x, y, colWidth, values.dist, labels.dist, distColor);
  drawSingleStat(ctx, x + colWidth, y, colWidth, values.dur, labels.dur, colorTokens.content.inverse);
  drawSingleStat(ctx, x + colWidth * 2, y, colWidth, values.pace, labels.pace, paceColor);

  ctx.restore();
}

function drawSingleStat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  value: string,
  label: string,
  accentColor: string
) {
  ctx.save();
  const centerX = x + width / 2;

  ctx.fillStyle = colorTokens.socialCard.stats.label;
  ctx.font = "bold 20px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, centerX, y);

  ctx.fillStyle = accentColor;
  ctx.font = "bold 64px system-ui, sans-serif";
  ctx.fillText(value, centerX, y + 74);

  ctx.restore();
}

function drawSecondaryStats(
  ctx: CanvasRenderingContext2D,
  activity: ActivityDetail,
  options: CardRenderOptions,
  x: number,
  y: number,
  width: number
) {
  ctx.save();

  const isCycling = activity.sport === "cycling";
  const chips: { icon: string; label: string; val: string }[] = [];

  // Elevation
  if (activity.elevationGainM != null && activity.elevationGainM > 0) {
    chips.push({
      icon: "▲",
      label: options.language === "pt" ? "Elevação" : "Elevation",
      val: formatElevation(activity.elevationGainM),
    });
  }

  // Cycling Max Speed
  if (isCycling && activity.maxSpeedKmh != null && activity.maxSpeedKmh > 0) {
    chips.push({
      icon: "⚡",
      label: options.language === "pt" ? "Vel. Máx" : "Max Speed",
      val: formatSpeed(activity.maxSpeedKmh),
    });
  }

  // Power (Watts)
  if (activity.avgWatts != null && activity.avgWatts > 0) {
    chips.push({
      icon: "⚡",
      label: options.language === "pt" ? "Potência" : "Power",
      val: formatWatts(activity.avgWatts),
    });
  }

  // Cadence (RPM)
  if (activity.avgCadenceRpm != null && activity.avgCadenceRpm > 0) {
    chips.push({
      icon: "↻",
      label: options.language === "pt" ? "Cadência" : "Cadence",
      val: `${Math.round(activity.avgCadenceRpm)} RPM`,
    });
  }

  // Heart Rate
  if (activity.avgHr != null && activity.avgHr > 0) {
    chips.push({
      icon: "♥",
      label: options.language === "pt" ? "FC Média" : "Avg HR",
      val: `${Math.round(activity.avgHr)} bpm`,
    });
  }

  // Calories
  if (activity.calories != null && activity.calories > 0 && chips.length < 4) {
    chips.push({
      icon: "🔥",
      label: options.language === "pt" ? "Calorias" : "Calories",
      val: formatCalories(activity.calories),
    });
  }

  if (chips.length === 0) return;

  // Cap at max 4 chips
  const displayedChips = chips.slice(0, 4);
  const gap = 16;
  const chipWidth = (width - (displayedChips.length - 1) * gap) / displayedChips.length;

  displayedChips.forEach((chip, i) => {
    const cx = x + i * (chipWidth + gap);

    ctx.fillStyle = colorTokens.socialCard.stats.chipBackground;
    ctx.strokeStyle = colorTokens.socialCard.stats.chipBorder;
    ctx.lineWidth = 1.5;
    roundRect(ctx, cx, y, chipWidth, 80, 20);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = colorTokens.content.inverse;
    ctx.font = "bold 24px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${chip.icon}  ${chip.val}`, cx + chipWidth / 2, y + 40);
  });

  ctx.restore();
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  options: CardRenderOptions,
  x: number,
  y: number,
  width: number
) {
  ctx.save();

  if (options.showPrBadge && options.prBadgeText) {
    ctx.fillStyle = colorTokens.socialCard.stats.badgeBackground;
    ctx.strokeStyle = colorTokens.socialCard.stats.badgeBorder;
    ctx.lineWidth = 2;
    const badgeW = Math.min(width, 540);
    const badgeX = x + (width - badgeW) / 2;
    roundRect(ctx, badgeX, y - 50, badgeW, 60, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = colorTokens.zones.power4;
    ctx.font = "bold 24px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`🏆  ${options.prBadgeText}`, x + width / 2, y - 20);
  } else {
    ctx.fillStyle = colorTokens.socialCard.stats.footerMuted;
    ctx.font = "500 20px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      options.language === "pt"
        ? "Gravado com RunFlow  ·  100% Offline & Open Source"
        : "Recorded with RunFlow  ·  100% Offline & Open Source",
      x + width / 2,
      y
    );
  }

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
