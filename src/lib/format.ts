import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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

export function formatDate(iso: string): string {
  return format(new Date(iso), "d MMM yyyy, HH:mm", { locale: ptBR });
}

export function formatRelative(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
}

export function formatElevation(meters: number | null | undefined): string {
  if (meters == null) return "—";
  return `${Math.round(meters)} m`;
}

export function formatCalories(kcal: number | null | undefined): string {
  if (kcal == null || kcal <= 0) return "—";
  return `${Math.round(kcal)} kcal`;
}

export function sportLabel(sport: string): string {
  const labels: Record<string, string> = {
    running: "Corrida",
    walking: "Caminhada",
    cycling: "Ciclismo",
    other: "Outro",
  };
  return labels[sport] ?? sport;
}
