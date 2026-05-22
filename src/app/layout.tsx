import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Activity, Home, Play, Upload, User } from "lucide-react";
import { CapacitorInit } from "@/components/CapacitorInit";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0c0f14",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RunFlow — Treinos de corrida",
  description:
    "Gerencie seus treinos de corrida. Open source, gratuito, com importação Amazfit/Zepp via GPX e FIT.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <CapacitorInit />
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
                  <span className="hidden sm:inline">Início</span>
                </Link>
                <Link
                  href="/gravar/"
                  className="nav-link flex items-center gap-1.5 text-[var(--accent)]"
                >
                  <Play size={16} />
                  <span className="hidden sm:inline">Gravar</span>
                </Link>
                <Link href="/atividades/" className="nav-link flex items-center gap-1.5">
                  <Activity size={16} />
                  <span className="hidden sm:inline">Atividades</span>
                </Link>
                <Link href="/importar/" className="nav-link flex items-center gap-1.5">
                  <Upload size={16} />
                  <span className="hidden sm:inline">Importar</span>
                </Link>
                <Link href="/perfil/" className="nav-link flex items-center gap-1.5">
                  <User size={16} />
                  <span className="hidden sm:inline">Perfil</span>
                </Link>
              </nav>
            </div>
          </header>
          <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
            {children}
          </main>
          <footer className="border-t border-[var(--border)] py-6 text-center text-sm text-[var(--muted)] safe-area-bottom">
            RunFlow — open source, gratuito, dados no seu dispositivo.
          </footer>
        </div>
      </body>
    </html>
  );
}
