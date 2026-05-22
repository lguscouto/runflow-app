import type { ActivityDetail, Sport, TrackPoint } from "./types";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toIsoUtc(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function sportToGpxType(sport: Sport): string {
  const map: Record<Sport, string> = {
    running: "running",
    walking: "walking",
    cycling: "biking",
    other: "other",
  };
  return map[sport] ?? "running";
}

function ensurePointTimestamps(
  points: TrackPoint[],
  startedAt: string,
  durationSec: number
): TrackPoint[] {
  const hasAll = points.every((p) => p.timestamp);
  if (hasAll) return points;

  const startMs = new Date(startedAt).getTime();
  const stepMs =
    points.length > 1
      ? (durationSec * 1000) / (points.length - 1)
      : 0;

  return points.map((p, i) => ({
    ...p,
    timestamp:
      p.timestamp ?? new Date(startMs + i * stepMs),
  }));
}

export function buildGpxXml(activity: ActivityDetail): string {
  const points = ensurePointTimestamps(
    activity.points,
    activity.startedAt,
    activity.durationSec
  );

  if (points.length === 0) {
    throw new Error("Treino sem pontos GPS para exportar.");
  }

  const name = escapeXml(activity.name);
  const type = sportToGpxType(activity.sport);
  const metaTime = toIsoUtc(new Date(activity.startedAt));

  const trkpts = points
    .map((p) => {
      const lines = [
        `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">`,
      ];
      if (p.elevation != null && Number.isFinite(p.elevation)) {
        lines.push(`        <ele>${p.elevation.toFixed(1)}</ele>`);
      }
      if (p.timestamp) {
        lines.push(`        <time>${toIsoUtc(p.timestamp)}</time>`);
      }
      if (p.hr != null) {
        lines.push(
          "        <extensions>",
          '          <gpxtpx:TrackPointExtension xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">',
          `            <gpxtpx:hr>${Math.round(p.hr)}</gpxtpx:hr>`,
          "          </gpxtpx:TrackPointExtension>",
          "        </extensions>"
        );
      }
      lines.push("      </trkpt>");
      return lines.join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RunFlow"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <metadata>
    <name>${name}</name>
    <time>${metaTime}</time>
  </metadata>
  <trk>
    <name>${name}</name>
    <type>${type}</type>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

export function gpxFilename(activity: ActivityDetail): string {
  const date = new Date(activity.startedAt);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const slug = activity.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "treino";
  return `runflow-${slug}-${y}${m}${d}.gpx`;
}
