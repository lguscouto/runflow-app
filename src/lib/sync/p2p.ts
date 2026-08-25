import type { DataConnection } from "peerjs";
import {
  assertValidSyncManifest,
  generateSyncManifest,
  getDeltaPayloadForRemote,
  applyIncomingPayload,
} from "./merger";
import type { SyncManifest, SyncPayload, SyncReport } from "../types";

export type P2PStatus =
  | "idle"
  | "initializing"
  | "waiting_for_peer"
  | "connecting"
  | "exchanging"
  | "completed"
  | "error";

export interface P2PEvents {
  onStatusChange?: (status: P2PStatus, message?: string) => void;
  onReport?: (report: SyncReport) => void;
  onError?: (err: string) => void;
}

const PEER_PREFIX = "runflow-";

function secureRandomValues(length: number): Uint32Array {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Web Crypto indisponível para o pareamento P2P.");
  }
  const values = new Uint32Array(length);
  globalThis.crypto.getRandomValues(values);
  return values;
}

async function pairingProof(code: string, challenge: string): Promise<string> {
  if (!globalThis.crypto?.subtle || typeof TextEncoder === "undefined") {
    throw new Error("Web Crypto indisponível para autenticar o pareamento P2P.");
  }
  const input = new TextEncoder().encode(`${PEER_PREFIX}${code}:${challenge}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Gera um código de pareamento de 6 caracteres aleatórios (alfanumérico maiúsculo).
 */
export function generatePairingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const randomValues = secureRandomValues(6);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(randomValues[i] % chars.length);
  }
  return code;
}

export function generatePairingToken(): string {
  const peerNonce = Array.from(secureRandomValues(4), (value) => value.toString(16).padStart(8, "0")).join("");
  return `${PEER_PREFIX}${peerNonce}.${generatePairingCode()}`;
}

function parsePairingToken(token: string): { peerId: string; secret: string } {
  const [rawPeerId, rawSecret, ...extra] = token.trim().split(".");
  const peerId = (rawPeerId ?? "").toLowerCase();
  const secret = sanitizePairingCode(rawSecret ?? "");
  if (
    extra.length > 0 ||
    !/^runflow-[a-f0-9]{32}$/.test(peerId ?? "") ||
    !/^[A-Z2-9]{6}$/.test(secret)
  ) {
    throw new Error("Código de pareamento inválido. Use o token completo exibido pelo outro aparelho.");
  }
  return { peerId, secret };
}

/**
 * Sanitiza o código inserido pelo usuário.
 */
export function sanitizePairingCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Sessão Host: cria uma sala P2P com um código e aguarda a conexão de outro aparelho.
 */
export class P2PHostSession {
  private peer: any = null;
  private conn: DataConnection | null = null;
  public code: string;
  private events: P2PEvents;
  private isDestroyed = false;
  private authenticated = false;
  private authChallenge: string | null = null;
  private hostProofPending = false;
  private peerId: string;

  constructor(pairingToken: string, events: P2PEvents) {
    const parsed = parsePairingToken(pairingToken);
    this.code = parsed.secret;
    this.peerId = parsed.peerId;
    this.events = events;
  }

  public async start(): Promise<void> {
    this.events.onStatusChange?.("initializing", "Iniciando servidor P2P...");

    try {
      const { default: Peer } = await import("peerjs");
      if (this.isDestroyed) return;
      this.peer = new Peer(this.peerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        },
      });

      this.peer.on("open", (id: string) => {
        if (this.isDestroyed) return;
        this.events.onStatusChange?.(
          "waiting_for_peer",
          `Aguardando conexão do outro aparelho com o código: ${this.code}`
        );
      });

      this.peer.on("connection", (conn: DataConnection) => {
        if (this.isDestroyed) return;
        this.conn = conn;
        this.events.onStatusChange?.("connecting", "Aparelho conectado! Negociando dados...");
        this.setupConnectionHandlers(conn);
      });

      this.peer.on("error", (err: any) => {
        if (this.isDestroyed) return;
        console.error("P2P Host Error:", err);
        if (err.type === "unavailable-id") {
          this.events.onError?.("Este código já está em uso. Gere um novo código.");
        } else {
          this.events.onError?.(err.message || "Erro na conexão P2P.");
        }
        this.events.onStatusChange?.("error");
      });
    } catch (err: any) {
      this.events.onError?.(err.message || "Falha ao inicializar WebRTC.");
      this.events.onStatusChange?.("error");
    }
  }

  private setupConnectionHandlers(conn: DataConnection): void {
    conn.on("open", async () => {
      if (this.isDestroyed || conn !== this.conn) return;
      this.authenticated = false;
      this.hostProofPending = false;
      this.authChallenge = Array.from(secureRandomValues(4), (value) => value.toString(16)).join("");
      conn.send({ type: "AUTH_CHALLENGE", challenge: this.authChallenge });
    });

    conn.on("data", async (data: any) => {
      if (this.isDestroyed || conn !== this.conn || !data || typeof data !== "object") return;

      if (data.type === "AUTH_RESPONSE" && typeof data.challenge === "string") {
        if (
          data.challenge !== this.authChallenge ||
          typeof data.proof !== "string" ||
          typeof data.peerChallenge !== "string"
        ) {
          conn.close();
          return;
        }
        let expectedProof: string;
        try {
          expectedProof = await pairingProof(this.code, data.challenge);
        } catch (err) {
          if (!this.isDestroyed) this.events.onError?.(err instanceof Error ? err.message : "Falha ao autenticar P2P.");
          conn.close();
          return;
        }
        if (this.isDestroyed || conn !== this.conn) return;
        if (data.proof !== expectedProof) {
          conn.close();
          return;
        }
        let hostProof: string;
        try {
          hostProof = await pairingProof(this.code, data.peerChallenge);
        } catch (err) {
          if (!this.isDestroyed) this.events.onError?.(err instanceof Error ? err.message : "Falha ao autenticar P2P.");
          conn.close();
          return;
        }
        if (this.isDestroyed || conn !== this.conn) return;
        this.authenticated = true;
        this.hostProofPending = true;
        conn.send({ type: "AUTH_OK", challenge: data.peerChallenge, proof: hostProof });
        return;
      }

      if (data.type === "AUTH_CONFIRM") {
        if (!this.authenticated || !this.hostProofPending) return;
        this.hostProofPending = false;
        this.events.onStatusChange?.("exchanging", "Pareamento autenticado. Trocando inventários...");
        let manifest: SyncManifest;
        try {
          manifest = await generateSyncManifest();
        } catch (err) {
          if (!this.isDestroyed) this.events.onError?.(err instanceof Error ? err.message : "Falha ao gerar manifesto P2P.");
          conn.close();
          return;
        }
        if (this.isDestroyed || conn !== this.conn || !this.authenticated) return;
        conn.send({ type: "HOST_MANIFEST", manifest });
        return;
      }

      if (!this.authenticated || this.hostProofPending) return;

      if (data.type === "JOINER_PAYLOAD_AND_MANIFEST") {
        this.events.onStatusChange?.("exchanging", "Sincronizando registros recebidos...");

        // 1. Aplica o payload vindo do Joiner
        let appliedResult: Awaited<ReturnType<typeof applyIncomingPayload>>;
        try {
          assertValidSyncManifest(data.manifest);
          appliedResult = await applyIncomingPayload(data.payload);
        } catch (err) {
          if (!this.isDestroyed) this.events.onError?.(err instanceof Error ? err.message : "Payload P2P rejeitado.");
          conn.close();
          return;
        }
        if (this.isDestroyed || conn !== this.conn || !this.authenticated) return;

        // 2. Calcula delta que o Host tem e o Joiner precisa
        let deltaForJoiner: SyncPayload;
        try {
          deltaForJoiner = await getDeltaPayloadForRemote(data.manifest);
        } catch (err) {
          if (!this.isDestroyed) this.events.onError?.(err instanceof Error ? err.message : "Falha ao calcular delta P2P.");
          conn.close();
          return;
        }
        const activitiesSent = deltaForJoiner.activities?.length || 0;
        const gearSent = deltaForJoiner.gear?.length || 0;
        const routesSent = deltaForJoiner.routes?.length || 0;

        // 3. Envia delta de volta ao Joiner
        conn.send({
          type: "HOST_DELTA",
          payload: deltaForJoiner,
        });

        const report: SyncReport = {
          activitiesReceived: appliedResult.activitiesReceived,
          activitiesSent,
          gearReceived: appliedResult.gearReceived,
          gearSent,
          routesReceived: appliedResult.routesReceived,
          routesSent,
          profileUpdated: appliedResult.profileUpdated,
          timestamp: new Date().toISOString(),
        };

        this.events.onReport?.(report);
        this.events.onStatusChange?.("completed", "Sincronização P2P concluída com sucesso!");
      }
    });

    conn.on("close", () => {
      if (!this.isDestroyed && !this.hostProofPending) {
        this.events.onStatusChange?.("error", "A conexão P2P foi encerrada antes da conclusão.");
      }
    });

    conn.on("error", (err: unknown) => {
      if (this.isDestroyed) return;
      this.events.onError?.(err instanceof Error ? err.message : "Erro na conexão P2P.");
      this.events.onStatusChange?.("error");
    });
  }

  public destroy(): void {
    this.isDestroyed = true;
    try {
      this.conn?.close();
      this.peer?.destroy();
    } catch (e) {
      console.error(e);
    }
  }
}

/**
 * Sessão Joiner: conecta-se a um Host através do código de pareamento.
 */
export class P2PJoinerSession {
  private peer: any = null;
  private conn: DataConnection | null = null;
  public targetCode: string;
  private events: P2PEvents;
  private isDestroyed = false;
  private authenticated = false;
  private targetPeerId: string;
  private authChallenge: string | null = null;

  constructor(pairingToken: string, events: P2PEvents) {
    const parsed = parsePairingToken(pairingToken);
    this.targetCode = parsed.secret;
    this.targetPeerId = parsed.peerId;
    this.events = events;
  }

  public async start(): Promise<void> {
    this.events.onStatusChange?.("connecting", "Conectando ao outro aparelho...");

    try {
      const { default: Peer } = await import("peerjs");
      if (this.isDestroyed) return;
      this.peer = new Peer({
        debug: 1,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        },
      });

      this.peer.on("open", () => {
        if (this.isDestroyed) return;
        const conn = this.peer.connect(this.targetPeerId, { reliable: true });
        this.conn = conn;
        this.setupConnectionHandlers(conn);
      });

      this.peer.on("error", (err: any) => {
        if (this.isDestroyed) return;
        console.error("P2P Joiner Error:", err);
        if (err.type === "peer-unavailable") {
          this.events.onError?.("Aparelho não encontrado. Verifique se o código está correto e o outro aparelho está aguardando.");
        } else {
          this.events.onError?.(err.message || "Erro ao conectar.");
        }
        this.events.onStatusChange?.("error");
      });
    } catch (err: any) {
      this.events.onError?.(err.message || "Falha ao inicializar WebRTC.");
      this.events.onStatusChange?.("error");
    }
  }

  private setupConnectionHandlers(conn: DataConnection): void {
    let joinerManifest: SyncManifest;
    let activitiesSent = 0;
    let gearSent = 0;
    let routesSent = 0;

    conn.on("open", () => {
      this.authenticated = false;
      this.authChallenge = null;
      this.events.onStatusChange?.("exchanging", "Conectado! Aguardando manifesto do host...");
    });

    conn.on("data", async (data: any) => {
      if (this.isDestroyed || conn !== this.conn || !data || typeof data !== "object") return;

      if (data.type === "AUTH_CHALLENGE" && typeof data.challenge === "string") {
        let proof: string;
        try {
          proof = await pairingProof(this.targetCode, data.challenge);
        } catch (err) {
          if (!this.isDestroyed) this.events.onError?.(err instanceof Error ? err.message : "Falha ao autenticar P2P.");
          conn.close();
          return;
        }
        if (this.isDestroyed || conn !== this.conn) return;
        this.authChallenge = Array.from(secureRandomValues(4), (value) => value.toString(16).padStart(8, "0")).join("");
        conn.send({
          type: "AUTH_RESPONSE",
          challenge: data.challenge,
          proof,
          peerChallenge: this.authChallenge,
        });
        return;
      }

      if (data.type === "AUTH_OK") {
        if (
          !this.authChallenge ||
          data.challenge !== this.authChallenge ||
          typeof data.proof !== "string"
        ) {
          conn.close();
          return;
        }
        let expectedProof: string;
        try {
          expectedProof = await pairingProof(this.targetCode, data.challenge);
        } catch (err) {
          if (!this.isDestroyed) this.events.onError?.(err instanceof Error ? err.message : "Falha ao autenticar P2P.");
          conn.close();
          return;
        }
        if (data.proof !== expectedProof) {
          conn.close();
          return;
        }
        this.authenticated = true;
        conn.send({ type: "AUTH_CONFIRM" });
        this.events.onStatusChange?.("exchanging", "Pareamento autenticado. Aguardando manifesto do host...");
        return;
      }

      if (!this.authenticated) return;

      if (data.type === "HOST_MANIFEST") {
        this.events.onStatusChange?.("exchanging", "Calculando diferenças...");
        const hostManifest: SyncManifest = data.manifest;
        let deltaForHost: SyncPayload;
        try {
          assertValidSyncManifest(hostManifest);
          // 1. Gera manifesto local e calcula o delta que o Host precisa
          joinerManifest = await generateSyncManifest();
          deltaForHost = await getDeltaPayloadForRemote(hostManifest);
        } catch (err) {
          if (!this.isDestroyed) this.events.onError?.(err instanceof Error ? err.message : "Falha ao processar manifesto P2P.");
          conn.close();
          return;
        }
        if (this.isDestroyed || conn !== this.conn || !this.authenticated) return;

        activitiesSent = deltaForHost.activities?.length || 0;
        gearSent = deltaForHost.gear?.length || 0;
        routesSent = deltaForHost.routes?.length || 0;

        // 2. Envia manifesto local e delta para o Host
        conn.send({
          type: "JOINER_PAYLOAD_AND_MANIFEST",
          manifest: joinerManifest,
          payload: deltaForHost,
        });
      } else if (data.type === "HOST_DELTA") {
        this.events.onStatusChange?.("exchanging", "Gravando dados recebidos...");

        // 3. Aplica o delta vindo do Host
        let appliedResult: Awaited<ReturnType<typeof applyIncomingPayload>>;
        try {
          appliedResult = await applyIncomingPayload(data.payload);
        } catch (err) {
          if (!this.isDestroyed) this.events.onError?.(err instanceof Error ? err.message : "Payload P2P rejeitado.");
          conn.close();
          return;
        }
        if (this.isDestroyed || conn !== this.conn || !this.authenticated) return;

        const report: SyncReport = {
          activitiesReceived: appliedResult.activitiesReceived,
          activitiesSent,
          gearReceived: appliedResult.gearReceived,
          gearSent,
          routesReceived: appliedResult.routesReceived,
          routesSent,
          profileUpdated: appliedResult.profileUpdated,
          timestamp: new Date().toISOString(),
        };

        this.events.onReport?.(report);
        this.events.onStatusChange?.("completed", "Sincronização P2P concluída com sucesso!");

        // Fecha após alguns segundos
        setTimeout(() => {
          this.destroy();
        }, 2000);
      }
    });

    conn.on("close", () => {
      if (!this.isDestroyed) {
        this.events.onStatusChange?.("error", "A conexão P2P foi encerrada antes da conclusão.");
      }
    });

    conn.on("error", (err: unknown) => {
      if (this.isDestroyed) return;
      this.events.onError?.(err instanceof Error ? err.message : "Erro na conexão P2P.");
      this.events.onStatusChange?.("error");
    });
  }

  public destroy(): void {
    this.isDestroyed = true;
    try {
      this.conn?.close();
      this.peer?.destroy();
    } catch (e) {
      console.error(e);
    }
  }
}
