"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Home, MapPin, Play, Upload, User } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { haptics } from "@/lib/haptics";
import React from "react";

import { OnboardingWizard } from "@/components/OnboardingWizard";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { t, loading } = useI18n();
  const pathname = usePathname() || "/";

  const isHome = pathname === "/" || pathname === "";
  const isRecord = pathname.startsWith("/gravar");
  const isActivities = pathname.startsWith("/atividades");
  const isImport = pathname.startsWith("/importar");
  const isRoutes = pathname.startsWith("/rotas");
  const isProfile = pathname.startsWith("/perfil");

  const handleNavClick = () => {
    haptics.light();
  };

  return (
    <div className="min-h-screen flex flex-col safe-area-app">
      {/* Top Header */}
      <header className="border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur sticky top-0 z-50 safe-area-top">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            prefetch={false}
            href="/"
            onClick={handleNavClick}
            className="touch-target flex items-center gap-2 font-bold text-lg shrink-0"
          >
            <span className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center text-[var(--on-accent)] text-sm shadow-sm font-black tracking-tighter">
              RF
            </span>
            <span>RunFlow</span>
          </Link>

          {/* Desktop Navigation (>= sm / 640px) */}
          <nav className="hidden sm:flex items-center gap-1" aria-label={t("nav.main_navigation")}>
            <Link
              prefetch={false}
              href="/"
              onClick={handleNavClick}
              aria-current={isHome ? "page" : undefined}
              className={`nav-link flex items-center gap-1.5 ${isHome ? "active text-[var(--accent)] font-semibold" : ""}`}
            >
              <Home size={16} />
              <span>{t("nav.home")}</span>
            </Link>
            <Link
              prefetch={false}
              href="/gravar/"
              onClick={handleNavClick}
              aria-current={isRecord ? "page" : undefined}
              className={`nav-link flex items-center gap-1.5 text-[var(--accent)] ${isRecord ? "active font-bold" : ""}`}
            >
              <Play size={16} />
              <span>{t("nav.record")}</span>
            </Link>
            <Link
              prefetch={false}
              href="/atividades/"
              onClick={handleNavClick}
              aria-current={isActivities ? "page" : undefined}
              className={`nav-link flex items-center gap-1.5 ${isActivities ? "active text-[var(--accent)] font-semibold" : ""}`}
            >
              <Activity size={16} />
              <span>{t("nav.activities")}</span>
            </Link>
            <Link
              prefetch={false}
              href="/importar/"
              onClick={handleNavClick}
              aria-current={isImport ? "page" : undefined}
              className={`nav-link flex items-center gap-1.5 ${isImport ? "active text-[var(--accent)] font-semibold" : ""}`}
            >
              <Upload size={16} />
              <span>{t("nav.import")}</span>
            </Link>
            <Link
              prefetch={false}
              href="/rotas/"
              onClick={handleNavClick}
              aria-current={isRoutes ? "page" : undefined}
              className={`nav-link flex items-center gap-1.5 ${isRoutes ? "active text-[var(--accent)] font-semibold" : ""}`}
            >
              <MapPin size={16} />
              <span>{t("nav.routes")}</span>
            </Link>
            <Link
              prefetch={false}
              href="/perfil/"
              onClick={handleNavClick}
              aria-current={isProfile ? "page" : undefined}
              className={`nav-link flex items-center gap-1.5 ${isProfile ? "active text-[var(--accent)] font-semibold" : ""}`}
            >
              <User size={16} />
              <span>{t("nav.profile")}</span>
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            {/* Mobile Top Header Quick Action (Import GPX/FIT) */}
            <div className="flex sm:hidden items-center gap-2">
              <Link
                prefetch={false}
                href="/importar/"
                onClick={handleNavClick}
                aria-current={isImport ? "page" : undefined}
                className={`touch-target p-2 rounded-lg text-sm border border-[var(--border)] transition-colors ${
                  isImport
                    ? "bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/40"
                    : "text-[var(--muted)] hover:text-[var(--text)] bg-[var(--surface)]"
                }`}
                title={t("nav.import")}
                aria-label={t("nav.import")}
              >
                <Upload size={18} />
              </Link>
            </div>
            <ThemeToggle
              lightLabel={t("theme.switch_to_light")}
              darkLabel={t("theme.switch_to_dark")}
            />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-8 pb-24 sm:pb-8">
        {loading ? (
          <div className="text-center py-20 text-[var(--muted)] text-sm">
            {t("common.loading")}
          </div>
        ) : (
          <>
            {children}
            <OnboardingWizard />
          </>
        )}
      </main>

      {/* Desktop Footer (>= sm) */}
      <footer className="hidden sm:block border-t border-[var(--border)] py-6 text-center text-sm text-[var(--muted)] safe-area-bottom">
        {t("footer.text")}
      </footer>

      {/* Mobile Bottom Navigation Bar (< sm / 640px) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bottom-nav-bar safe-area-bottom px-2 py-1 flex items-center justify-around shadow-2xl"
        aria-label={t("nav.main_navigation")}
      >
        <Link
          prefetch={false}
          href="/"
          onClick={handleNavClick}
          aria-current={isHome ? "page" : undefined}
          className={`bottom-nav-link ${isHome ? "active font-bold" : ""}`}
        >
          <Home size={20} />
          <span>{t("nav.home")}</span>
        </Link>

        <Link
          prefetch={false}
          href="/atividades/"
          onClick={handleNavClick}
          aria-current={isActivities ? "page" : undefined}
          className={`bottom-nav-link ${isActivities ? "active font-bold" : ""}`}
        >
          <Activity size={20} />
          <span>{t("nav.activities")}</span>
        </Link>

        {/* Center Prominent Record FAB */}
        <Link
          prefetch={false}
          href="/gravar/"
          onClick={handleNavClick}
          aria-current={isRecord ? "page" : undefined}
          className="bottom-nav-fab"
          aria-label={t("nav.record")}
          title={t("nav.record")}
        >
          <Play size={22} className="fill-[var(--on-accent)] ml-0.5" />
        </Link>

        <Link
          prefetch={false}
          href="/rotas/"
          onClick={handleNavClick}
          aria-current={isRoutes ? "page" : undefined}
          className={`bottom-nav-link ${isRoutes ? "active font-bold" : ""}`}
        >
          <MapPin size={20} />
          <span>{t("nav.routes")}</span>
        </Link>

        <Link
          prefetch={false}
          href="/perfil/"
          onClick={handleNavClick}
          aria-current={isProfile ? "page" : undefined}
          className={`bottom-nav-link ${isProfile ? "active font-bold" : ""}`}
        >
          <User size={20} />
          <span>{t("nav.profile")}</span>
        </Link>
      </nav>
    </div>
  );
}