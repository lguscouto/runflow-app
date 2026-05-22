import type { ParsedActivity, Sport, TrackPoint } from "../types";
import { distanceFromPoints, elevationGainFromPoints } from "../geo";

function parseGpxTime(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function extractTag(block: string, tag: string): string | undefined {
  const selfClosing = new RegExp(`<${tag}[^>]*value="([^"]*)"`, "i");
  const m1 = block.match(selfClosing);
  if (m1) return m1[1];
  const open = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
  const m2 = block.match(open);
  return m2?.[1]?.trim();
}

function parseTrackPoints(xml: string): TrackPoint[] {
  const points: TrackPoint[] = [];
  const trkptRegex = /<trkpt\s+([^>]*)>([\s\S]*?)<\/trkpt>/gi;
  let match: RegExpExecArray | null;

  while ((match = trkptRegex.exec(xml)) !== null) {
    const attrs = match[1];
    const inner = match[2];
    const lat = parseFloat(attrs.match(/lat="([^"]+)"/i)?.[1] ?? "");
    const lng = parseFloat(attrs.match(/lon="([^"]+)"/i)?.[1] ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const eleStr = extractTag(inner, "ele");
    const timeStr = extractTag(inner, "time");
    const hrStr =
      extractTag(inner, "gpxtpx:hr") ??
      extractTag(inner, "hr") ??
      inner.match(/<ns3:hr>(\d+)<\/ns3:hr>/i)?.[1];

    points.push({
      lat,
      lng,
      elevation: eleStr ? parseFloat(eleStr) : undefined,
      timestamp: parseGpxTime(timeStr),
      hr: hrStr ? parseInt(hrStr, 10) : undefined,
    });
  }

  return points;
}

function inferSport(xml: string, fileName: string): Sport {
  const lower = (xml + fileName).toLowerCase();
  if (/cycling|bike|ride|ciclismo/.test(lower)) return "cycling";
  if (/walk|walking|caminhada/.test(lower)) return "walking";
  return "running";
}

function computeMetrics(points: TrackPoint[], durationSec: number) {
  const distanceM = distanceFromPoints(points);
  const elevationGainM = elevationGainFromPoints(points);
  const hrs = points.map((p) => p.hr).filter((h): h is number => h != null);
  const avgHr = hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : undefined;
  const maxHr = hrs.length ? Math.max(...hrs) : undefined;

  let avgPaceSecKm: number | undefined;
  if (distanceM > 0 && durationSec > 0) {
    avgPaceSecKm = (durationSec / distanceM) * 1000;
  }

  return { distanceM, elevationGainM, avgHr, maxHr, avgPaceSecKm };
}

export function parseGpx(content: string, fileName: string): ParsedActivity {
  const points = parseTrackPoints(content);
  if (points.length < 2) {
    throw new Error("GPX sem pontos de trajeto suficientes.");
  }

  const nameMatch = content.match(/<name>([^<]*)<\/name>/i);
  const name = nameMatch?.[1]?.trim() || fileName.replace(/\.gpx$/i, "");

  const startedAt =
    points.find((p) => p.timestamp)?.timestamp ?? new Date();

  const endTime = [...points].reverse().find((p) => p.timestamp)?.timestamp;
  let durationSec = 0;
  if (endTime && startedAt) {
    durationSec = Math.max(0, (endTime.getTime() - startedAt.getTime()) / 1000);
  }
  if (durationSec <= 0) {
    durationSec = Math.max(60, points.length * 5);
  }

  const metrics = computeMetrics(points, durationSec);

  return {
    name,
    sport: inferSport(content, fileName),
    startedAt,
    durationSec,
    ...metrics,
    points,
  };
}
