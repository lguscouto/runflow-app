"use client";

import { useEffect, useState, useRef } from "react";
import {
  Wifi,
  Cloud,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Server,
  ArrowRightLeft,
  ShieldCheck,
  Smartphone,
  Laptop,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  generatePairingToken,
  P2PHostSession,
  P2PJoinerSession,
  type P2PStatus,
} from "@/lib/sync/p2p";
import {
  getWebDavConfig,
  markWebDavConfigSynced,
  saveWebDavConfig,
  syncWebDav,
} from "@/lib/sync/webdav";
import type { SyncReport, WebDavConfig } from "@/lib/types";
import {
  isLocalNetworkPermissionGranted,
  requestLocalNetworkPermissionStatus,
} from "@/lib/local-network";

interface SyncPanelProps {
  onSyncSuccess?: () => void;
}

export function SyncPanel({ onSyncSuccess }: SyncPanelProps) {
  const { t, language } = useI18n();

  // Mode: "p2p" | "webdav"
  const [syncMode, setSyncMode] = useState<"p2p" | "webdav">("p2p");

  // P2P State
  const [hostCode, setHostCode] = useState<string | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [p2pStatus, setP2pStatus] = useState<P2PStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [p2pReport, setP2pReport] = useState<SyncReport | null>(null);
  const [p2pError, setP2pError] = useState<string | null>(null);

  const activeHostSession = useRef<P2PHostSession | null>(null);
  const activeJoinerSession = useRef<P2PJoinerSession | null>(null);
  const mountedRef = useRef(true);
  const p2pTabRef = useRef<HTMLButtonElement>(null);
  const webdavTabRef = useRef<HTMLButtonElement>(null);

  const selectSyncMode = (mode: "p2p" | "webdav") => {
    setSyncMode(mode);
    if (mode === "p2p") setP2pError(null);
    else setWebdavError(null);
  };

  const handleSyncModeKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const nextMode = syncMode === "p2p" ? "webdav" : "p2p";
    selectSyncMode(nextMode);
    (nextMode === "p2p" ? p2pTabRef : webdavTabRef).current?.focus();
  };

  // WebDAV State
  const [webdavUrl, setWebdavUrl] = useState("");
  const [webdavUser, setWebdavUser] = useState("");
  const [webdavPass, setWebdavPass] = useState("");
  const [webdavPath, setWebdavPath] = useState("runflow/vault.json");
  const [webdavLastSynced, setWebdavLastSynced] = useState<string | null>(null);
  const [webdavLoading, setWebdavLoading] = useState(false);
  const [webdavError, setWebdavError] = useState<string | null>(null);
  const [webdavReport, setWebdavReport] = useState<SyncReport | null>(null);

  // Carregar configurações salvas de WebDAV
  useEffect(() => {
    const cfg = getWebDavConfig();
    if (cfg) {
      setWebdavUrl(cfg.serverUrl || "");
      setWebdavUser(cfg.username || "");
      setWebdavPass(cfg.password || "");
      setWebdavPath(cfg.remotePath || "runflow/vault.json");
      setWebdavLastSynced(cfg.lastSyncedAt || null);
    }
  }, []);

  // Cleanup de sessões P2P ao desmontar
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeHostSession.current?.destroy();
      activeJoinerSession.current?.destroy();
    };
  }, []);

  // ── P2P Handlers ─────────────────────────────────────────────────────────

  const handleStartHost = async () => {
    const permissionStatus = await requestLocalNetworkPermissionStatus();
    if (!mountedRef.current) return;
    if (!isLocalNetworkPermissionGranted(permissionStatus)) {
      setP2pError(t("sync.local_network_denied"));
      return;
    }
    // Limpar sessões anteriores
    activeHostSession.current?.destroy();
    activeJoinerSession.current?.destroy();
    setP2pError(null);
    setP2pReport(null);

    const code = generatePairingToken();
    setHostCode(code);

    const session = new P2PHostSession(code, {
      onStatusChange: (status, msg) => {
        if (!mountedRef.current) return;
        setP2pStatus(status);
        if (msg) setStatusMessage(msg);
      },
      onReport: (report) => {
        if (!mountedRef.current) return;
        setP2pReport(report);
        onSyncSuccess?.();
      },
      onError: (err) => {
        if (!mountedRef.current) return;
        setP2pError(err);
      },
    });

    activeHostSession.current = session;
    session.start();
  };

  const handleStartJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;

    const permissionStatus = await requestLocalNetworkPermissionStatus();
    if (!mountedRef.current) return;
    if (!isLocalNetworkPermissionGranted(permissionStatus)) {
      setP2pError(t("sync.local_network_denied"));
      return;
    }
    activeHostSession.current?.destroy();
    activeJoinerSession.current?.destroy();
    setP2pError(null);
    setP2pReport(null);

    const session = new P2PJoinerSession(joinCodeInput, {
      onStatusChange: (status, msg) => {
        if (!mountedRef.current) return;
        setP2pStatus(status);
        if (msg) setStatusMessage(msg);
      },
      onReport: (report) => {
        if (!mountedRef.current) return;
        setP2pReport(report);
        onSyncSuccess?.();
      },
      onError: (err) => {
        if (!mountedRef.current) return;
        setP2pError(err);
      },
    });

    activeJoinerSession.current = session;
    session.start();
  };

  const handleCopyCode = () => {
    if (!hostCode) return;
    navigator.clipboard.writeText(hostCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── WebDAV Handlers ──────────────────────────────────────────────────────

  const handleWebDavSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webdavUrl.trim() || !webdavUser.trim()) return;

    setWebdavLoading(true);
    setWebdavError(null);
    setWebdavReport(null);

    const config: WebDavConfig = {
      serverUrl: webdavUrl.trim(),
      username: webdavUser.trim(),
      password: webdavPass,
      remotePath: webdavPath.trim() || "runflow/vault.json",
    };

    try {
      const report = await syncWebDav(config);
      if (!mountedRef.current) return;
      const syncedConfig = markWebDavConfigSynced(config);
      saveWebDavConfig(syncedConfig);
      setWebdavReport(report);
      setWebdavLastSynced(syncedConfig.lastSyncedAt || null);
      onSyncSuccess?.();
    } catch (err: any) {
      console.error("WebDAV sync error:", err);
      if (mountedRef.current) setWebdavError(err.message || t("common.error"));
    } finally {
      if (mountedRef.current) setWebdavLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-Tabs: P2P vs WebDAV */}
      <div role="tablist" aria-label={t("sync.mode_label")} className="flex border-b border-[var(--border)] gap-2">
        <button
          ref={p2pTabRef}
          type="button"
          role="tab"
          id="sync-tab-p2p"
          aria-selected={syncMode === "p2p"}
          aria-controls="sync-panel-p2p"
          tabIndex={syncMode === "p2p" ? 0 : -1}
          onKeyDown={handleSyncModeKeyDown}
          onClick={() => selectSyncMode("p2p")}
          className={`pb-3 px-4 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
            syncMode === "p2p"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
          }`}
        >
          <Wifi size={16} />
          {t("sync.tab_p2p")}
        </button>
        <button
          ref={webdavTabRef}
          type="button"
          role="tab"
          id="sync-tab-webdav"
          aria-selected={syncMode === "webdav"}
          aria-controls="sync-panel-webdav"
          tabIndex={syncMode === "webdav" ? 0 : -1}
          onKeyDown={handleSyncModeKeyDown}
          onClick={() => selectSyncMode("webdav")}
          className={`pb-3 px-4 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
            syncMode === "webdav"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
          }`}
        >
          <Cloud size={16} />
          {t("sync.tab_webdav")}
        </button>
      </div>

      {/* ── ABA 1: Sincronização P2P Direta ── */}
      {syncMode === "p2p" && (
        <div id="sync-panel-p2p" role="tabpanel" aria-labelledby="sync-tab-p2p" tabIndex={0} className="space-y-6">
          <div className="stat-card border-[var(--border)] space-y-2">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="text-[var(--accent)]" size={18} />
              <h3 className="font-bold text-sm">{t("sync.p2p_title")}</h3>
            </div>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              {t("sync.p2p_desc")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bloco 1: Host */}
            <div className="stat-card space-y-4 flex flex-col justify-between border-[var(--border)]">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Smartphone size={18} className="text-[var(--accent)]" />
                  <h4 className="font-bold text-sm">{t("sync.p2p_host_title")}</h4>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {t("sync.p2p_host_desc")}
                </p>
              </div>

              {hostCode ? (
                <div className="space-y-3 pt-2">
                  <p className="text-xs text-[var(--muted)]">{t("sync.your_code")}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-[var(--bg)] border border-[var(--accent)]/50 rounded-xl px-4 py-3 text-center text-2xl font-mono font-bold tracking-widest text-[var(--accent)]">
                      {hostCode}
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="btn-ghost py-3 px-3.5 border border-[var(--border)] shrink-0"
                      title={t("sync.copy_code")}
                      aria-label={t("sync.copy_code")}
                    >
                      {copied ? <Check size={18} className="text-[var(--color-status-positive)]" /> : <Copy size={18} />}
                    </button>
                  </div>
                  {p2pStatus === "waiting_for_peer" && (
                    <div className="flex items-center justify-center gap-2 text-xs text-[var(--color-status-warning)] animate-pulse pt-1">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      {t("sync.waiting_peer")}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleStartHost}
                  className="btn-primary w-full justify-center py-2.5"
                >
                  <Wifi size={16} />
                  {t("sync.generate_code")}
                </button>
              )}
            </div>

            {/* Bloco 2: Joiner */}
            <div className="stat-card space-y-4 flex flex-col justify-between border-[var(--border)]">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Laptop size={18} className="text-[var(--accent)]" />
                  <h4 className="font-bold text-sm">{t("sync.p2p_join_title")}</h4>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {t("sync.p2p_join_desc")}
                </p>
              </div>

              <form onSubmit={handleStartJoin} className="space-y-3 pt-2">
                <input
                  id="sync-p2p-join-code"
                  type="text"
                  maxLength={47}
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder={t("sync.enter_code")}
                  aria-label={t("sync.enter_code")}
                  className="profile-input text-center font-mono font-bold tracking-widest text-lg"
                  disabled={p2pStatus === "connecting" || p2pStatus === "exchanging"}
                />
                <button
                  type="submit"
                  disabled={!joinCodeInput.trim() || p2pStatus === "connecting" || p2pStatus === "exchanging"}
                  className="btn-primary w-full justify-center py-2.5"
                >
                  <RefreshCw
                    size={16}
                    className={p2pStatus === "connecting" || p2pStatus === "exchanging" ? "animate-spin" : ""}
                  />
                  {t("sync.connect_btn")}
                </button>
              </form>
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div role="status" aria-live="polite" className="stat-card py-3 px-4 border-[var(--accent)]/30 bg-[var(--accent-soft)]/20 text-xs flex items-center gap-2">
              <RefreshCw size={14} className="text-[var(--accent)] animate-spin shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* P2P Error */}
          {p2pError && (
            <div role="alert" aria-live="assertive" className="flex items-start gap-3 p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-[var(--color-status-danger)] text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p>{p2pError}</p>
            </div>
          )}

          {/* P2P Report */}
          {p2pReport && (
            <div role="status" aria-live="polite" className="stat-card border-emerald-500/40 bg-emerald-500/10 space-y-3">
              <div className="flex items-center gap-2 text-[var(--color-status-positive)] font-bold text-sm">
                <CheckCircle2 size={18} />
                {t("sync.report_title")}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-center">
                  <span className="block font-bold text-sm text-[var(--accent)]">
                    +{p2pReport.activitiesReceived}
                  </span>
                  <span className="text-[var(--muted)]">{t("sync.received")}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-center">
                  <span className="block font-bold text-sm text-[var(--color-status-positive)]">
                    ↑{p2pReport.activitiesSent}
                  </span>
                  <span className="text-[var(--muted)]">{t("sync.sent")}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-center">
                  <span className="block font-bold text-sm text-[var(--text)]">
                    {p2pReport.gearReceived + p2pReport.gearSent}
                  </span>
                  <span className="text-[var(--muted)]">{t("sync.gear_sync")}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-center">
                  <span className="block font-bold text-sm text-[var(--text)]">
                    {p2pReport.routesReceived + p2pReport.routesSent}
                  </span>
                  <span className="text-[var(--muted)]">{t("sync.routes_sync")}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ABA 2: Nuvem Pessoal WebDAV ── */}
      {syncMode === "webdav" && (
        <div id="sync-panel-webdav" role="tabpanel" aria-labelledby="sync-tab-webdav" tabIndex={0} className="space-y-6">
          <div className="stat-card border-[var(--border)] space-y-2">
            <div className="flex items-center gap-2">
              <Server className="text-[var(--accent)]" size={18} />
              <h3 className="font-bold text-sm">{t("sync.webdav_title")}</h3>
            </div>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              {t("sync.webdav_desc")}
            </p>
          </div>

          <form onSubmit={handleWebDavSync} className="stat-card space-y-4 border-[var(--border)]">
            <div>
              <label htmlFor="sync-webdav-url" className="block text-xs text-[var(--muted)] mb-1">
                {t("sync.webdav_server_url")} *
              </label>
              <input
                id="sync-webdav-url"
                type="url"
                required
                value={webdavUrl}
                onChange={(e) => setWebdavUrl(e.target.value)}
                placeholder={t("sync.webdav_server_placeholder")}
                className="profile-input text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="sync-webdav-user" className="block text-xs text-[var(--muted)] mb-1">
                  {t("sync.webdav_user")} *
                </label>
                <input
                  id="sync-webdav-user"
                  type="text"
                  required
                  value={webdavUser}
                  onChange={(e) => setWebdavUser(e.target.value)}
                  placeholder={t("sync.webdav_user_placeholder")}
                  className="profile-input text-sm"
                />
              </div>

              <div>
                <label htmlFor="sync-webdav-pass" className="block text-xs text-[var(--muted)] mb-1">
                  {t("sync.webdav_pass")}
                </label>
                <input
                  id="sync-webdav-pass"
                  type="password"
                  value={webdavPass}
                  onChange={(e) => setWebdavPass(e.target.value)}
                  placeholder="••••••••••••"
                  className="profile-input text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="sync-webdav-path" className="block text-xs text-[var(--muted)] mb-1">
                {t("sync.webdav_path")}
              </label>
              <input
                id="sync-webdav-path"
                type="text"
                value={webdavPath}
                onChange={(e) => setWebdavPath(e.target.value)}
                placeholder="runflow/vault.json"
                className="profile-input text-sm"
              />
            </div>

            {webdavLastSynced && (
              <p className="text-xs text-[var(--muted)]">
                {t("sync.last_synced")}{" "}
                <strong className="text-[var(--text)]">
                  {new Date(webdavLastSynced).toLocaleString(language === "pt" ? "pt-BR" : "en-US")}
                </strong>
              </p>
            )}

            <button
              type="submit"
              disabled={webdavLoading}
              className="btn-primary w-full justify-center py-2.5"
            >
              <RefreshCw size={16} className={webdavLoading ? "animate-spin" : ""} />
              {webdavLoading ? t("sync.webdav_syncing") : t("sync.webdav_sync_now")}
            </button>
          </form>

          {/* WebDAV Error */}
          {webdavError && (
            <div role="alert" aria-live="assertive" className="flex items-start gap-3 p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-[var(--color-status-danger)] text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p>{webdavError}</p>
            </div>
          )}

          {/* WebDAV Report */}
          {webdavReport && (
            <div role="status" aria-live="polite" className="stat-card border-emerald-500/40 bg-emerald-500/10 space-y-3">
              <div className="flex items-center gap-2 text-[var(--color-status-positive)] font-bold text-sm">
                <CheckCircle2 size={18} />
                {t("sync.report_title")}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-center">
                  <span className="block font-bold text-sm text-[var(--accent)]">
                    +{webdavReport.activitiesReceived}
                  </span>
                  <span className="text-[var(--muted)]">{t("sync.received")}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-center">
                  <span className="block font-bold text-sm text-[var(--color-status-positive)]">
                    ↑{webdavReport.activitiesSent}
                  </span>
                  <span className="text-[var(--muted)]">{t("sync.sent")}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-center">
                  <span className="block font-bold text-sm text-[var(--text)]">
                    {webdavReport.gearReceived + webdavReport.gearSent}
                  </span>
                  <span className="text-[var(--muted)]">{t("sync.gear_sync")}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-center">
                  <span className="block font-bold text-sm text-[var(--text)]">
                    {webdavReport.routesReceived + webdavReport.routesSent}
                  </span>
                  <span className="text-[var(--muted)]">{t("sync.routes_sync")}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info Card sobre Privacidade */}
      <div className="stat-card border-[var(--border)]/60 bg-[var(--surface)]/40 p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
          <ShieldCheck size={16} className="text-[var(--color-status-positive)]" />
          {t("sync.how_it_works_title")}
        </div>
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          {t("sync.how_it_works_desc")}
        </p>
      </div>
    </div>
  );
}
