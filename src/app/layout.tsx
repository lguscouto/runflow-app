import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CapacitorInit } from "@/components/CapacitorInit";
import { ThemeProvider } from "@/components/ThemeProvider";
import { colorTokens } from "@/lib/color-tokens";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: colorTokens.surface.app,
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

import { I18nProvider } from "@/lib/i18n";
import { AppLayout } from "@/components/AppLayout";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          <CapacitorInit />
          <I18nProvider>
            <AppLayout>{children}</AppLayout>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
