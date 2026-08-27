"use client";

import { useEffect, useRef, useState } from "react";
import {
  Share2,
  Download,
  X,
  Sparkles,
  Camera,
  Image as ImageIcon,
  Check,
  Smartphone,
  Square,
  Loader2,
} from "lucide-react";
import type { ActivityDetail } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import {
  renderSocialCard,
  type CardFormat,
  type CardTheme,
  type CardRenderOptions,
} from "@/lib/social-card";
import { shareOrDownloadImage } from "@/lib/share-file";
import { useModalA11y } from "@/hooks/useModalA11y";

interface SocialShareCardModalProps {
  activity: ActivityDetail;
  prBadgeText?: string | null;
}

export function SocialShareCardModal({
  activity,
  prBadgeText,
}: SocialShareCardModalProps) {
  const { t, language } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  // Card Options
  const [format, setFormat] = useState<CardFormat>("stories");
  const [theme, setTheme] = useState<CardTheme>(
    activity.sport === "cycling" ? "peloton" : "cyberpunk"
  );
  const [customImage, setCustomImage] = useState<HTMLImageElement | null>(null);
  const [customImageSrc, setCustomImageSrc] = useState<string | null>(null);

  // Toggles
  const [showMap, setShowMap] = useState(activity.points.length >= 2);
  const [showStats, setShowStats] = useState(true);
  const [showSecondaryStats, setShowSecondaryStats] = useState(true);
  const [showPrBadge, setShowPrBadge] = useState(Boolean(prBadgeText));
  const [showBranding, setShowBranding] = useState(true);

  // UI Status
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { modalRef } = useModalA11y({
    isOpen,
    onClose: () => setIsOpen(false),
  });

  // Render on change
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const options: CardRenderOptions = {
      format,
      theme,
      customImage,
      showMap: showMap && activity.points.length >= 2,
      showStats,
      showSecondaryStats,
      showPrBadge: showPrBadge && Boolean(prBadgeText),
      prBadgeText,
      showBranding,
      language: language as "pt" | "en",
    };

    renderSocialCard(canvasRef.current, activity, options);
  }, [
    isOpen,
    format,
    theme,
    customImage,
    showMap,
    showStats,
    showSecondaryStats,
    showPrBadge,
    showBranding,
    language,
    activity,
    prBadgeText,
  ]);

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      setCustomImageSrc(src);
      const img = new Image();
      img.onload = () => {
        setCustomImage(img);
        setTheme("custom");
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  function getFilename() {
    const dateStr = new Date(activity.startedAt).toISOString().slice(0, 10);
    const safeTitle = (activity.name || "treino")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-");
    return `runflow-${safeTitle}-${dateStr}-${format}.png`;
  }

  async function handleShare() {
    if (!canvasRef.current) return;
    setIsProcessing(true);
    setStatusMsg(null);
    try {
      const dataUrl = canvasRef.current.toDataURL("image/png", 0.95);
      await shareOrDownloadImage(dataUrl, getFilename());
      setStatusMsg({ type: "ok", text: t("share_card.success_share") });
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: "err", text: t("share_card.error_share") });
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleDownload() {
    if (!canvasRef.current) return;
    setIsProcessing(true);
    setStatusMsg(null);
    try {
      const dataUrl = canvasRef.current.toDataURL("image/png", 0.95);
      const safeName = getFilename();
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = safeName;
      anchor.click();
      setStatusMsg({ type: "ok", text: t("share_card.success_share") });
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: "err", text: t("share_card.error_share") });
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="btn-ghost flex items-center gap-1.5 text-[var(--accent)] border-[var(--accent)]/40 hover:border-[var(--accent)]"
        title={t("share_card.modal_subtitle")}
      >
        <Sparkles size={16} />
        {t("share_card.open_btn")}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("share_card.modal_title")}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-[var(--accent)]/20 text-[var(--accent)] flex items-center justify-center">
                  <Sparkles size={18} />
                </span>
                <div>
                  <h2 className="text-base sm:text-lg font-bold">
                    {t("share_card.modal_title")}
                  </h2>
                  <p className="text-xs text-[var(--muted)] hidden sm:block">
                    {t("share_card.modal_subtitle")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={language === "en" ? "Close modal" : "Fechar modal"}
                className="w-8 h-8 rounded-lg bg-[var(--surface-hover)] text-[var(--muted)] hover:text-[var(--text)] flex items-center justify-center transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body: 2 Columns */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 p-4 sm:p-6 overflow-y-auto">
              {/* Left Column: Live Canvas Preview */}
              <div className="md:col-span-6 flex flex-col items-center justify-center bg-[var(--color-surface-social-preview)] border border-[var(--border)] rounded-xl p-3 sm:p-4 min-h-[340px]">
                <div
                  className={`relative flex items-center justify-center max-h-[55vh] overflow-hidden rounded-xl shadow-2xl border border-[var(--border)] transition-all ${
                    format === "stories" ? "aspect-[9/16]" : "aspect-square"
                  }`}
                >
                  <canvas
                    ref={canvasRef}
                    className="max-h-[55vh] max-w-full w-auto h-auto object-contain rounded-xl"
                  />
                </div>
                <p className="text-[11px] text-white/70 mt-2">
                  {format === "stories" ? "1080 × 1920 px (9:16)" : "1080 × 1080 px (1:1)"}
                </p>
              </div>

              {/* Right Column: Customization Controls */}
              <div className="md:col-span-6 space-y-5">
                {/* 1. Format Selection */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
                    {t("share_card.format")}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormat("stories")}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                        format === "stories"
                          ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)] shadow"
                          : "border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      <Smartphone size={16} />
                      {t("share_card.format_stories")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormat("feed")}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                        format === "feed"
                          ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)] shadow"
                          : "border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      <Square size={16} />
                      {t("share_card.format_feed")}
                    </button>
                  </div>
                </div>

                {/* 2. Theme Selection */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
                    {t("share_card.theme")}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { key: "peloton" as const, label: t("share_card.theme_peloton"), color: "from-amber-500 via-cyan-500 to-blue-600" },
                      { key: "cyberpunk" as const, label: t("share_card.theme_cyberpunk"), color: "from-cyan-500 to-pink-500" },
                      { key: "minimal" as const, label: t("share_card.theme_minimal"), color: "from-slate-800 to-zinc-900" },
                      { key: "sunset" as const, label: t("share_card.theme_sunset"), color: "from-purple-600 via-pink-600 to-orange-500" },
                      { key: "topo" as const, label: t("share_card.theme_topo"), color: "from-emerald-900 to-slate-900" },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setTheme(item.key)}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-medium transition-all text-left ${
                          theme === item.key
                            ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] shadow"
                            : "border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)]"
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded-full bg-gradient-to-tr ${item.color} shrink-0`}
                        />
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}

                    {/* Custom Photo Theme */}
                    <button
                      type="button"
                      onClick={() => {
                        if (customImage) {
                          setTheme("custom");
                        } else {
                          fileInputRef.current?.click();
                        }
                      }}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-medium transition-all text-left ${
                        theme === "custom"
                          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] shadow"
                          : "border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      <Camera size={16} className="text-[var(--accent)] shrink-0" />
                      <span className="truncate">{t("share_card.theme_custom")}</span>
                    </button>
                  </div>

                  {/* Photo Upload Area */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />

                  {customImageSrc && (
                    <div className="flex items-center justify-between mt-2.5 p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs">
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={customImageSrc}
                          alt="Thumbnail"
                          className="w-6 h-6 rounded object-cover"
                        />
                        <span className="text-[var(--muted)]">
                          {activity.sport === "cycling" ? "Foto da Bike" : t("share_card.theme_custom")}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[var(--accent)] hover:underline font-semibold"
                      >
                        {t("share_card.change_photo")}
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. Toggles & Visibility */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
                    Opções de Conteúdo
                  </label>
                  <div className="space-y-2 text-xs">
                    {activity.points.length >= 2 && (
                      <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showMap}
                          onChange={(e) => setShowMap(e.target.checked)}
                          className="rounded accent-[var(--accent)]"
                        />
                        <span>{t("share_card.show_map")}</span>
                      </label>
                    )}

                    <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showStats}
                        onChange={(e) => setShowStats(e.target.checked)}
                        className="rounded accent-[var(--accent)]"
                      />
                      <span>{t("share_card.show_stats")}</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showSecondaryStats}
                        onChange={(e) => setShowSecondaryStats(e.target.checked)}
                        className="rounded accent-[var(--accent)]"
                      />
                      <span>{t("share_card.show_secondary")}</span>
                    </label>

                    {prBadgeText && (
                      <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showPrBadge}
                          onChange={(e) => setShowPrBadge(e.target.checked)}
                          className="rounded accent-[var(--accent)]"
                        />
                        <span>{t("share_card.show_pr")}</span>
                      </label>
                    )}

                    <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showBranding}
                        onChange={(e) => setShowBranding(e.target.checked)}
                        className="rounded accent-[var(--accent)]"
                      />
                      <span>{t("share_card.show_branding")}</span>
                    </label>
                  </div>
                </div>

                {/* Status Message */}
                {statusMsg && (
                  <div
                    className={`p-2.5 rounded-lg text-xs font-semibold ${
                      statusMsg.type === "ok"
                        ? "bg-emerald-500/10 text-[var(--color-status-positive)] border border-emerald-500/20"
                        : "bg-red-500/10 text-[var(--color-status-danger)] border border-red-500/20"
                    }`}
                  >
                    {statusMsg.text}
                  </div>
                )}

                {/* 4. Action Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleShare}
                    disabled={isProcessing}
                    className="btn-primary w-full justify-center py-3 text-sm font-bold shadow-lg"
                  >
                    {isProcessing ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Share2 size={18} />
                    )}
                    {isProcessing ? t("share_card.generating") : t("share_card.share_btn")}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={isProcessing}
                    className="btn-ghost w-full sm:w-auto justify-center py-3 px-4 text-sm font-semibold"
                  >
                    <Download size={18} />
                    {t("share_card.download_btn")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
