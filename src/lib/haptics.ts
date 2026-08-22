import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

/**
 * Utilitário de feedback tátil háptico nativo com fallback para Web Vibration API.
 */
class HapticsService {
  /**
   * Vibração leve / suave para cliques de botões e navegação.
   */
  async light(): Promise<void> {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      this.webVibrate(15);
    }
  }

  /**
   * Vibração média para transições de estado, play/pause e trocas de etapa.
   */
  async medium(): Promise<void> {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      this.webVibrate(35);
    }
  }

  /**
   * Vibração firme/pesada para início/fim de corrida, marcação de lap e fechamento de split.
   */
  async heavy(): Promise<void> {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      this.webVibrate(60);
    }
  }

  /**
   * Padrão de sucesso / conquista (celebração de PR, meta atingida, salvamento).
   */
  async success(): Promise<void> {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      this.webVibrate([40, 60, 80]);
    }
  }

  /**
   * Padrão de alerta / aviso (saída de rota, auto-pause).
   */
  async warning(): Promise<void> {
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch {
      this.webVibrate([60, 40, 60]);
    }
  }

  /**
   * Padrão de erro / descarte.
   */
  async error(): Promise<void> {
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch {
      this.webVibrate([80, 50, 80, 50, 100]);
    }
  }

  /**
   * Vibração personalizada por tempo (ms).
   */
  async vibrate(durationMs: number = 300): Promise<void> {
    try {
      await Haptics.vibrate({ duration: durationMs });
    } catch {
      this.webVibrate(durationMs);
    }
  }

  /**
   * Fallback usando a Web Vibration API caso disponível.
   */
  private webVibrate(pattern: number | number[]) {
    if (typeof window !== "undefined" && "navigator" in window && "vibrate" in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignora silenciosamente se o navegador bloquear vibração
      }
    }
  }
}

export const haptics = new HapticsService();
