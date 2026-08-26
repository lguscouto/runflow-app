"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { MapPin, Trash2, Undo2, Save, Route } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { RoutePoint, SavedRoute } from "@/lib/types";
import { routeDistanceM } from "@/lib/route-geo";
import { putRoute } from "@/lib/storage";
import { MapSkeleton } from "@/components/LoadingSkeletons";

const DrawMap = dynamic(
  () => import("@/components/DrawMap").then((m) => m.DrawMap),
  {
    ssr: false,
    loading: () => (
      <MapSkeleton label="Carregando mapa / Loading map" height={420} />
    ),
  }
);

export function RouteDrawClient() {
  const router = useRouter();
  const { t, language } = useI18n();
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [name, setName] = useState<string>("");
  const [saved, setSaved] = useState(false);

  const distance = useMemo(() => routeDistanceM(points), [points]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setPoints((prev) => [...prev, { lat, lng }]);
  }, []);

  const handleUndo = useCallback(() => {
    setPoints((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setPoints([]);
    setSaved(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (points.length < 2 || !name.trim()) return;

    const route: SavedRoute = {
      id: `route_${Date.now()}`,
      name: name.trim(),
      points,
      distanceM: distance,
      source: "drawn",
      createdAt: new Date().toISOString(),
    };

    await putRoute(route);
    setSaved(true);
    setTimeout(() => {
      router.push("/rotas/");
    }, 1200);
  }, [points, name, distance, router]);

  const canSave = points.length >= 2 && name.trim().length > 0 && !saved;

  return (
    <div className="space-y-6 -mt-2">
      <div>
        <h1 className="text-2xl font-bold">{t("route_draw.title")}</h1>
        <p className="text-[var(--muted)] text-sm mt-1 flex items-center gap-1.5">
          <MapPin size={14} className="text-[var(--accent)]" />
          {t("route_draw.instruction")}
        </p>
      </div>

      {/* Map */}
      <DrawMap points={points} onMapClick={handleMapClick} />

      {/* Distance display */}
      <div className="stat-card flex items-center justify-between border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center gap-2">
          <Route size={18} className="text-[var(--accent)]" />
          <span className="text-sm font-semibold text-[var(--text)]">
            {distance >= 1000
              ? `${(distance / 1000).toFixed(2)} km`
              : `${Math.round(distance)} m`}
          </span>
        </div>
        <span className="text-xs text-[var(--muted)]">
          {points.length} {t("routes.points").toLowerCase()}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleUndo}
          disabled={points.length === 0 || saved}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--muted)] hover:border-[var(--muted)] hover:text-[var(--text)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Undo2 size={16} />
          {t("route_draw.undo")}
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={points.length === 0 || saved}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--muted)] hover:border-red-500/50 hover:text-red-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 size={16} />
          {t("route_draw.clear")}
        </button>
      </div>

      {/* Name input */}
      <div>
        <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">
          {language === "en" ? "Route Name" : "Nome da Rota"}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          placeholder={t("route_draw.name_placeholder")}
          disabled={saved}
          className="w-full text-sm rounded-xl bg-[var(--background)] border border-[var(--border)] text-[var(--text)] px-4 py-3 outline-none focus:border-[var(--accent)] transition-colors font-semibold placeholder:font-normal placeholder:text-[var(--muted)] disabled:opacity-50"
        />
      </div>

      {/* Min points hint */}
      {points.length === 0 && (
        <p className="text-xs text-[var(--muted)] flex items-center gap-1.5">
          <MapPin size={12} />
          {t("route_draw.min_points")}
        </p>
      )}

      {/* Save success message */}
      {saved && (
        <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm font-semibold text-center">
          ✅ {t("route_draw.saved")}
        </div>
      )}

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base transition-all ${
          canSave
            ? "bg-[var(--accent)] text-white active:scale-95"
            : "border border-[var(--border)] text-[var(--muted)] cursor-not-allowed"
        }`}
      >
        <Save size={20} />
        {t("route_draw.save")}
      </button>

      {points.length < 2 && points.length > 0 && (
        <p className="text-xs text-amber-500/80 text-center">{t("route_draw.min_points")}</p>
      )}
    </div>
  );
}
