"use client";

import { MapTrack } from "./MapTrack";
import type { TrackPoint } from "@/lib/types";

export function ActivityMap({
  points,
  height = "360px",
}: {
  points: TrackPoint[];
  height?: string;
}) {
  return <MapTrack points={points} height={height} />;
}
