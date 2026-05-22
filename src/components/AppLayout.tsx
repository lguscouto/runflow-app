"use client";

import Link from "next/link";
import { Activity, Home, Play, Upload, User } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import React from "react";

import { OnboardingWizard } from "@/components/OnboardingWizard";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { t, loading } = useI18n();

  return (
    <div className="min-h-screen flex flex-col safe-area-app">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur sticky top-0 z-50 safe-area-top">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
            <span className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center text-white text-sm">
              RF
            </span>
            RunFlow
          </Link>
          <nav className="flex items-center gap-1">
            <Link href="/" className="nav-link flex items-center gap-1.5">
              <Home size={16} />
              <span className="hidden sm:inline">{t("nav.home")}</span>
            </Link>
            <Link
              href="/gravar/"
              className="nav-link flex items-center gap-1.5 text-[var(--accent)]"
            >
              <Play size={16} />
              <span className="hidden sm:inline">{t("nav.record")}</span>
            </Link>
            <Link href="/atividades/" className="nav-link flex items-center gap-1.5">
              <Activity size={16} />
              <span className="hidden sm:inline">{t("nav.activities")}</span>
            </Link>
            <Link href="/importar/" className="nav-link flex items-center gap-1.5">
              <Upload size={16} />
              <span className="hidden sm:inline">{t("nav.import")}</span>
            </Link>
            <Link href="/perfil/" className="nav-link flex items-center gap-1.5">
              <User size={16} />
              <span className="hidden sm:inline">{t("nav.profile")}</span>
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
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
      <footer className="border-t border-[var(--border)] py-6 text-center text-sm text-[var(--muted)] safe-area-bottom">
        {t("footer.text")}
      </footer>
    </div>
  );
}
