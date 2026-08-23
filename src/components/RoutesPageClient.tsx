"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAllStoredRoutes, removeRoute } from "@/lib/storage";
import { importRouteGpx } from "@/lib/parsers/route-gpx";
import { putRoute } from "@/lib/storage";
import { SavedRoute } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { formatDistance } from "@/lib/format";
import { MapPin, Plus, Trash2, Route, ArrowLeft, Mountain, Sparkles } from "lucide-react";
import { detectClimbs, getCategoryBadgeStyle } from "@/lib/climb-detection";

export function RoutesPageClient() {
  const { t } = useI18n();
  const router = useRouter();
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadRoutes() {
    try {
      setError(null);
      const stored = await getAllStoredRoutes();
      setRoutes(stored);
    } catch (err) {
      console.error("Failed to load routes:", err);
      setError(t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRoutes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleImportGpx(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);

    try {
      const text = await file.text();
      const route = importRouteGpx(text, file.name);
      await putRoute(route);
      await loadRoutes();
    } catch (err) {
      console.error("Failed to import GPX route:", err);
      setError(t("routes.import_error"));
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleDelete(route: SavedRoute) {
    if (!confirm(t("routes.confirm_delete"))) return;

    try {
      await removeRoute(route.id);
      await loadRoutes();
    } catch (err) {
      console.error("Failed to delete route:", err);
      setError(t("common.error"));
    }
  }

  async function handleCreateSampleMountainRoute() {
    setImporting(true);
    setError(null);
    try {
      // Cria uma rota de exemplo com subidas categorizadas (Serra da Mantiqueira)
      const startLat = -22.738;
      const startLng = -45.592;
      const points: Array<{ lat: number; lng: number; elevation?: number }> = [];
      const numPts = 60;
      for (let i = 0; i < numPts; i++) {
        const frac = i / (numPts - 1);
        const lat = startLat + frac * 0.04;
        const lng = startLng + Math.sin(frac * Math.PI * 3) * 0.015;
        // Perfil com 2 subidas: 1ª subida Cat 3 e 2ª subida Cat 4
        let elev = 800;
        if (i <= 20) {
          // Subida 1: 800m -> 980m em 1.5km (~12% grade)
          elev = 800 + (i / 20) * 180;
        } else if (i <= 35) {
          // Descida: 980m -> 850m
          elev = 980 - ((i - 20) / 15) * 130;
        } else {
          // Subida 2: 850m -> 1020m em 2km (~8.5% grade)
          elev = 850 + ((i - 35) / 24) * 170;
        }
        points.push({ lat, lng, elevation: Math.round(elev) });
      }

      // Haversine calc distance
      let totalDist = 0;
      for (let i = 1; i < points.length; i++) {
        const dLat = ((points[i].lat - points[i - 1].lat) * Math.PI) / 180;
        const dLon = ((points[i].lng - points[i - 1].lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((points[i - 1].lat * Math.PI) / 180) *
            Math.cos((points[i].lat * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        totalDist += 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }

      const sampleRoute: SavedRoute = {
        id: `route_sample_${Date.now()}`,
        name: "Desafio da Serra (ClimbPro Test)",
        distanceM: Math.round(totalDist),
        elevationGainM: 350,
        points,
        createdAt: new Date().toISOString(),
        source: "drawn",
        color: "#f59e0b",
      };

      await putRoute(sampleRoute);
      await loadRoutes();
    } catch (e) {
      console.error("Erro ao criar rota de exemplo:", e);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
          aria-label={t("common.back")}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{t("routes.title")}</h1>
          <p className="text-[var(--muted)] text-sm">
            {t("routes.subtitle")}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".gpx"
          className="hidden"
          onChange={handleImportGpx}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg font-semibold text-sm hover:bg-[var(--surface-hover)] transition-colors cursor-pointer disabled:opacity-50"
        >
          <MapPin className="w-4 h-4" />
          {importing ? t("common.loading") : t("routes.import_btn")}
        </button>
        <Link
          href="/rotas/criar/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          {t("routes.create_btn")}
        </Link>
        <button
          type="button"
          onClick={handleCreateSampleMountainRoute}
          disabled={importing}
          className="inline-flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg font-semibold text-xs hover:bg-amber-500/20 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>+ Rota Altimetria (ClimbPro)</span>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="py-12 text-center text-[var(--muted)] text-sm">
          {t("common.loading")}
        </div>
      )}

      {/* Empty State */}
      {!loading && routes.length === 0 && (
        <div className="py-16 flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
            <Route className="w-10 h-10 text-[var(--muted)]" />
          </div>
          <p className="text-[var(--muted)] text-lg">{t("routes.empty")}</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity cursor-pointer"
            >
              <MapPin className="w-4 h-4" />
              {t("routes.import_btn")}
            </button>
            <Link
              href="/rotas/criar/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg font-semibold text-sm hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t("routes.create_btn")}
            </Link>
            <button
              type="button"
              onClick={handleCreateSampleMountainRoute}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-lg font-semibold text-sm hover:bg-amber-500/25 transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>+ Gerar Rota com Subidas</span>
            </button>
          </div>
        </div>
      )}

      {/* Route List */}
      {!loading && routes.length > 0 && (
        <div className="space-y-3">
          {routes.map((route) => {
            const climbs = detectClimbs(route.points);

            return (
              <div
                key={route.id}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                {/* Route info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Route className="w-4 h-4 text-[var(--accent)] shrink-0" />
                    <h3 className="font-semibold truncate">{route.name}</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
                    <span>
                      {t("routes.distance")}: {formatDistance(route.distanceM)}
                    </span>
                    <span>
                      {t("routes.points")}: {route.points.length}
                    </span>
                    <span>
                      {new Date(route.createdAt).toLocaleDateString()}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        route.source === "imported"
                          ? "bg-blue-500/10 text-blue-400"
                          : "bg-green-500/10 text-green-400"
                      }`}
                    >
                      {route.source === "imported"
                        ? t("routes.source_imported")
                        : t("routes.source_drawn")}
                    </span>
                  </div>

                  {/* Climb Badges Preview */}
                  {climbs.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
                        <Mountain size={12} />
                        <span>{climbs.length} subida(s):</span>
                      </span>
                      {climbs.map((climb) => {
                        const badgeStyle = getCategoryBadgeStyle(climb.category);
                        return (
                          <span
                            key={climb.id}
                            style={{ backgroundColor: badgeStyle.badgeBg }}
                            className="px-1.5 py-0.2 rounded text-[9px] font-extrabold text-white uppercase"
                          >
                            {badgeStyle.label} ({climb.avgGradePct.toFixed(1)}%)
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/gravar/?routeId=${route.id}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[var(--accent)] text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    {t("routes.use_in_workout")}
                  </Link>
                  <button
                    onClick={() => handleDelete(route)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--muted)] hover:text-red-400 transition-colors cursor-pointer"
                    aria-label={t("routes.delete")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
