import type { DataConnection } from "peerjs";
import {
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

/**
 * Gera um código de pareamento de 6 caracteres aleatórios (alfanumérico maiúsculo).
 */
export function generatePairingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
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

  constructor(code: string, events: P2PEvents) {
    this.code = sanitizePairingCode(code);
    this.events = events;
  }

  public async start(): Promise<void> {
    this.events.onStatusChange?.("initializing", "Iniciando servidor P2P...");

    try {
      const { default: Peer } = await import("peerjs");
      const peerId = `${PEER_PREFIX}${this.code}`;

      this.peer = new Peer(peerId, {
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
      this.events.onStatusChange?.("exchanging", "Trocando inventários...");
      // Host envia seu manifesto para o par
      const manifest = await generateSyncManifest();
      conn.send({ type: "HOST_MANIFEST", manifest });
    });

    conn.on("data", async (data: any) => {
      if (!data || typeof data !== "object") return;

      if (data.type === "JOINER_PAYLOAD_AND_MANIFEST") {
        this.events.onStatusChange?.("exchanging", "Sincronizando registros recebidos...");

        // 1. Aplica o payload vindo do Joiner
        const appliedResult = await applyIncomingPayload(data.payload);

        // 2. Calcula delta que o Host tem e o Joiner precisa
        const deltaForJoiner = await getDeltaPayloadForRemote(data.manifest);
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
      // Conexão fechada
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

  constructor(targetCode: string, events: P2PEvents) {
    this.targetCode = sanitizePairingCode(targetCode);
    this.events = events;
  }

  public async start(): Promise<void> {
    this.events.onStatusChange?.("connecting", "Conectando ao outro aparelho...");

    try {
      const { default: Peer } = await import("peerjs");
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
        const hostPeerId = `${PEER_PREFIX}${this.targetCode}`;
        const conn = this.peer.connect(hostPeerId, { reliable: true });
        this.conn = conn;
        this.setupConnectionHandlers(conn);
      });

      this.peer.on("error", (err: any) => {
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
      this.events.onStatusChange?.("exchanging", "Conectado! Aguardando manifesto do host...");
    });

    conn.on("data", async (data: any) => {
      if (!data || typeof data !== "object") return;

      if (data.type === "HOST_MANIFEST") {
        this.events.onStatusChange?.("exchanging", "Calculando diferenças...");
        const hostManifest: SyncManifest = data.manifest;

        // 1. Gera manifesto local e calcula o delta que o Host precisa
        joinerManifest = await generateSyncManifest();
        const deltaForHost = await getDeltaPayloadForRemote(hostManifest);

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
        const appliedResult = await applyIncomingPayload(data.payload);

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
