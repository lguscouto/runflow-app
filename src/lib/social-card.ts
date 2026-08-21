import type { ActivityDetail, TrackPoint } from "./types";
import {
  formatDistance,
  formatDuration,
  formatPace,
  formatElevation,
  formatCalories,
  formatDate,
  sportLabel,
} from "./format";

export type CardFormat = "stories" | "feed";
export type CardTheme = "cyberpunk" | "minimal" | "sunset" | "topo" | "custom";

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
  ctx.fillStyle = "#3dd68c";
  ctx.shadowColor = "#3dd68c";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(startPt.px, startPt.py, lineWidth * 1.4, 0, Math.PI * 2);
  ctx.fill();

  const endPt = project(points[points.length - 1]);
  ctx.fillStyle = "#ff6b35";
  ctx.shadowColor = "#ff6b35";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(endPt.px, endPt.py, lineWidth * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
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

  ctx.clearRect(0, 0, width, height);

  drawBackground(ctx, width, height, options);

  const topPadding = isStories ? 140 : 80;
  const sidePadding = 80;

  if (options.showBranding) {
    drawBranding(ctx, sidePadding, topPadding);
  }

  const titleY = topPadding + (options.showBranding ? 110 : 40);
  drawHeaderInfo(ctx, activity, options, sidePadding, titleY, width - sidePadding * 2);

  const mapY = titleY + 160;
  const mapHeight = isStories ? 680 : 380;

  if (options.showMap && activity.points.length >= 2) {
    const mapBoxWidth = width - sidePadding * 2;
    drawMapContainer(ctx, activity.points, options, sidePadding, mapY, mapBoxWidth, mapHeight);
  }

  const statsY = isStories ? (options.showMap ? 1220 : 700) : (options.showMap ? 720 : 450);

  if (options.showStats) {
    drawPrimaryStats(ctx, activity, options, sidePadding, statsY, width - sidePadding * 2);
  }

  const secondaryY = statsY + (isStories ? 250 : 180);
  if (options.showSecondaryStats) {
    drawSecondaryStats(ctx, activity, options, sidePadding, secondaryY, width - sidePadding * 2);
  }

  const footerY = height - (isStories ? 120 : 70);
  drawFooter(ctx, options, sidePadding, footerY, width - sidePadding * 2);
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
    let sW = img.width;
    let sH = img.height;
    let sX = 0;
    let sY = 0;

    if (imgAspect > canvasAspect) {
      sW = img.height * canvasAspect;
      sX = (img.width - sW) / 2;
    } else {
      sH = img.width / canvasAspect;
      sY = (img.height - sH) / 2;
    }

    ctx.drawImage(img, sX, sY, sW, sH, 0, 0, width, height);

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "rgba(10, 14, 20, 0.75)");
    grad.addColorStop(0.5, "rgba(10, 14, 20, 0.45)");
    grad.addColorStop(1, "rgba(10, 14, 20, 0.92)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  if (options.theme === "cyberpunk") {
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#080b11");
    bgGrad.addColorStop(0.5, "#0d131f");
    bgGrad.addColorStop(1, "#180f24");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const radial = ctx.createRadialGradient(width * 0.8, height * 0.3, 50, width * 0.8, height * 0.3, 600);
    radial.addColorStop(0, "rgba(0, 240, 255, 0.15)");
    radial.addColorStop(1, "transparent");
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);

    const radial2 = ctx.createRadialGradient(width * 0.2, height * 0.7, 50, width * 0.2, height * 0.7, 600);
    radial2.addColorStop(0, "rgba(255, 0, 127, 0.12)");
    radial2.addColorStop(1, "transparent");
    ctx.fillStyle = radial2;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  if (options.theme === "sunset") {
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#1f102c");
    bgGrad.addColorStop(0.4, "#3b1638");
    bgGrad.addColorStop(0.75, "#b33939");
    bgGrad.addColorStop(1, "#ff6b35");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(0, 0, width, height);
    return;
  }

  if (options.theme === "topo") {
    ctx.fillStyle = "#0c1017";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(61, 214, 140, 0.05)";
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
  minGrad.addColorStop(0, "#0e131a");
  minGrad.addColorStop(1, "#161c26");
  ctx.fillStyle = minGrad;
  ctx.fillRect(0, 0, width, height);
}

function drawBranding(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.fillStyle = "rgba(255, 107, 53, 0.15)";
  ctx.strokeStyle = "rgba(255, 107, 53, 0.4)";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y - 40, 210, 60, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ff6b35";
  roundRect(ctx, x + 10, y - 30, 40, 40, 10);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("RF", x + 30, y - 10);

  ctx.fillStyle = "#f0f4f8";
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

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 56px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  let name = activity.name || (options.language === "pt" ? "Treino de Corrida" : "Running Workout");
  if (ctx.measureText(name).width > maxWidth) {
    while (name.length > 4 && ctx.measureText(name + "...").width > maxWidth) {
      name = name.slice(0, -1);
    }
    name += "...";
  }
  ctx.fillText(name, x, y);

  const sport = sportLabel(activity.sport, options.language);
  const dateStr = formatDate(activity.startedAt, options.language);
  const subText = `${sport}  ·  ${dateStr}`;

  ctx.fillStyle = "rgba(240, 244, 248, 0.7)";
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

  ctx.fillStyle = "rgba(18, 24, 36, 0.45)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, width, height, 32);
  ctx.fill();
  ctx.stroke();

  let strokeColor: string | CanvasGradient = "#ff6b35";
  let glowColor: string | undefined = "rgba(255, 107, 53, 0.4)";

  if (options.theme === "cyberpunk") {
    const grad = ctx.createLinearGradient(x, y, x + width, y + height);
    grad.addColorStop(0, "#00f0ff");
    grad.addColorStop(0.5, "#ff007f");
    grad.addColorStop(1, "#ff6b35");
    strokeColor = grad;
    glowColor = "rgba(0, 240, 255, 0.6)";
  } else if (options.theme === "sunset") {
    strokeColor = "#ffffff";
    glowColor = "rgba(255, 255, 255, 0.5)";
  } else if (options.theme === "topo") {
    strokeColor = "#3dd68c";
    glowColor = "rgba(61, 214, 140, 0.5)";
  } else if (options.theme === "minimal") {
    strokeColor = "#ff6b35";
    glowColor = "rgba(255, 107, 53, 0.35)";
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

  const colWidth = width / 3;
  const labels = options.language === "pt"
    ? { dist: "DISTÂNCIA", dur: "TEMPO", pace: "RITMO MÉDIO" }
    : { dist: "DISTANCE", dur: "TIME", pace: "AVG PACE" };

  const values = {
    dist: formatDistance(activity.distanceM),
    dur: formatDuration(activity.durationSec),
    pace: formatPace(activity.avgPaceSecKm),
  };

  drawSingleStat(ctx, x, y, colWidth, values.dist, labels.dist, "#ff6b35");
  drawSingleStat(ctx, x + colWidth, y, colWidth, values.dur, labels.dur, "#ffffff");
  drawSingleStat(ctx, x + colWidth * 2, y, colWidth, values.pace, labels.pace, "#3dd68c");

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

  ctx.fillStyle = "rgba(240, 244, 248, 0.6)";
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

  const chips: { icon: string; label: string; val: string }[] = [];

  if (activity.elevationGainM != null && activity.elevationGainM > 0) {
    chips.push({
      icon: "▲",
      label: options.language === "pt" ? "Elevação" : "Elevation",
      val: formatElevation(activity.elevationGainM),
    });
  }

  if (activity.avgHr != null && activity.avgHr > 0) {
    chips.push({
      icon: "♥",
      label: options.language === "pt" ? "FC Média" : "Avg HR",
      val: `${Math.round(activity.avgHr)} bpm`,
    });
  }

  if (activity.calories != null && activity.calories > 0) {
    chips.push({
      icon: "🔥",
      label: options.language === "pt" ? "Calorias" : "Calories",
      val: formatCalories(activity.calories),
    });
  }

  if (chips.length === 0) return;

  const chipWidth = (width - (chips.length - 1) * 20) / chips.length;

  chips.forEach((chip, i) => {
    const cx = x + i * (chipWidth + 20);

    ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, cx, y, chipWidth, 80, 20);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px system-ui, sans-serif";
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
    ctx.fillStyle = "rgba(245, 158, 11, 0.2)";
    ctx.strokeStyle = "rgba(245, 158, 11, 0.5)";
    ctx.lineWidth = 2;
    const badgeW = Math.min(width, 540);
    const badgeX = x + (width - badgeW) / 2;
    roundRect(ctx, badgeX, y - 50, badgeW, 60, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 24px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`🏆  ${options.prBadgeText}`, x + width / 2, y - 20);
  } else {
    ctx.fillStyle = "rgba(240, 244, 248, 0.4)";
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
