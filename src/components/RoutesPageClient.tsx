"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAllStoredRoutes, removeRoute } from "@/lib/storage";
import { importRouteGpx } from "@/lib/parsers/route-gpx";
import { putRoute } from "@/lib/storage";
import type { SavedRoute } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { formatDistance } from "@/lib/format";
import { MapPin, Plus, Trash2, Route, ArrowLeft } from "lucide-react";

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
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
        >
          <MapPin className="w-4 h-4" />
          {importing ? t("common.loading") : t("routes.import_btn")}
        </button>
        <Link
          href="/rotas/criar/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg font-semibold text-sm hover:bg-[var(--surface-hover)] transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t("routes.create_btn")}
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
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
          </div>
        </div>
      )}

      {/* Route List */}
      {!loading && routes.length > 0 && (
        <div className="space-y-3">
          {routes.map((route) => (
            <div
              key={route.id}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3"
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
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/gravar/?routeId=${route.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white rounded-md text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {t("routes.use_in_workout")}
                </Link>
                <button
                  onClick={() => handleDelete(route)}
                  className="p-2 rounded-md hover:bg-red-500/10 text-[var(--muted)] hover:text-red-400 transition-colors cursor-pointer"
                  aria-label={t("routes.delete")}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
