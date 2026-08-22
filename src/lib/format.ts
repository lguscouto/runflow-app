import { format, formatDistanceToNow } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatPace(secPerKm: number | null | undefined): string {
  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0) {
    return "—";
  }
  const m = Math.floor(secPerKm / 60);
  const s = Math.floor(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

export function formatDate(iso: string, lang: "pt" | "en" = "pt"): string {
  const locale = lang === "en" ? enUS : ptBR;
  return format(new Date(iso), "d MMM yyyy, HH:mm", { locale });
}

export function formatRelative(iso: string, lang: "pt" | "en" = "pt"): string {
  const locale = lang === "en" ? enUS : ptBR;
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale });
}

export function formatElevation(meters: number | null | undefined): string {
  if (meters == null) return "—";
  return `${Math.round(meters)} m`;
}

export function formatCalories(kcal: number | null | undefined): string {
  if (kcal == null || kcal <= 0) return "—";
  return `${Math.round(kcal)} kcal`;
}

export function formatSpeed(kmh: number | null | undefined): string {
  if (kmh == null || !Number.isFinite(kmh) || kmh < 0) {
    return "0.0 km/h";
  }
  return `${kmh.toFixed(1)} km/h`;
}

export function formatWatts(watts: number | null | undefined): string {
  if (watts == null || !Number.isFinite(watts) || watts < 0) {
    return "0 W";
  }
  return `${Math.round(watts)} W`;
}

export function formatGrade(percent: number | null | undefined): string {
  if (percent == null || !Number.isFinite(percent)) {
    return "0.0%";
  }
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toFixed(1)}%`;
}

export function formatVam(vamMh: number | null | undefined): string {
  if (vamMh == null || !Number.isFinite(vamMh) || vamMh <= 0) {
    return "0 VAM";
  }
  return `${Math.round(vamMh)} m/h`;
}

export function formatSportSpeedOrPace(
  sport: string,
  secPerKm: number | null | undefined,
  speedKmh?: number | null
): string {
  if (sport === "cycling") {
    if (speedKmh != null && speedKmh > 0) {
      return formatSpeed(speedKmh);
    }
    if (secPerKm != null && secPerKm > 0) {
      return formatSpeed(3600 / secPerKm);
    }
    return "0.0 km/h";
  }
  return formatPace(secPerKm);
}

export function sportLabel(sport: string, lang: "pt" | "en" = "pt"): string {
  const labels: Record<string, Record<string, string>> = {
    pt: {
      running: "Corrida",
      walking: "Caminhada",
      cycling: "Ciclismo",
      other: "Outro",
    },
    en: {
      running: "Run",
      walking: "Walk",
      cycling: "Ride",
      other: "Other",
    },
  };
  return labels[lang]?.[sport] ?? labels["pt"][sport] ?? sport;
}
