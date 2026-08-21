import type { VoiceCoachConfig } from "@/lib/types";

export const DEFAULT_VOICE_COACH_CONFIG: VoiceCoachConfig = {
  enabled: true,
  triggerType: "distance",
  distanceIntervalM: 1000,
  timeIntervalSec: 300,
  speakDistance: true,
  speakTime: true,
  speakAvgPace: true,
  speakCurrentPace: false,
  speakHeartRate: true,
  speakHeartRateZone: true,
  speakLastSplit: true,
  speechRate: 1.0,
  speechPitch: 1.0,
  speechVolume: 1.0,
};

export interface VoiceCoachStats {
  distanceM: number;
  elapsedSec: number;
  avgPaceSecKm: number | null;
  currentPaceSecKm?: number | null;
  heartRate?: number | null;
  heartRateZoneName?: string | null;
  lastSplitKm?: number | null;
  lastSplitPaceSecKm?: number | null;
}

/**
 * Converte segundos por quilômetro em texto fonético natural.
 */
export function formatPaceForSpeech(secKm: number, lang: "pt" | "en" = "pt"): string {
  if (!secKm || isNaN(secKm) || !isFinite(secKm) || secKm <= 0) return "";
  const total = Math.round(secKm);
  const min = Math.floor(total / 60);
  const sec = total % 60;

  if (lang === "pt") {
    if (sec === 0) return `${min} minutos por quilômetro`;
    return `${min} minutos e ${sec} segundos por quilômetro`;
  } else {
    if (sec === 0) return `${min} minutes per kilometer`;
    return `${min} minutes and ${sec} seconds per kilometer`;
  }
}

/**
 * Converte distância em metros em fala fluida.
 */
export function formatDistanceForSpeech(distanceM: number, lang: "pt" | "en" = "pt"): string {
  if (distanceM <= 0) return "";
  const km = distanceM / 1000;

  if (lang === "pt") {
    if (km < 1) {
      return `${Math.round(distanceM)} metros`;
    }
    const kmInt = Math.floor(km);
    const metersRem = Math.round(distanceM % 1000);
    if (metersRem === 0) {
      return `${kmInt} ${kmInt === 1 ? "quilômetro" : "quilômetros"}`;
    }
    const dec = (km).toFixed(1).replace(".", ",");
    return `${dec} quilômetros`;
  } else {
    if (km < 1) {
      return `${Math.round(distanceM)} meters`;
    }
    const dec = km.toFixed(1);
    return `${dec} kilometers`;
  }
}

/**
 * Converte tempo decorrido em fala natural.
 */
export function formatDurationForSpeech(totalSec: number, lang: "pt" | "en" = "pt"): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);

  if (lang === "pt") {
    const parts: string[] = [];
    if (h > 0) parts.push(`${h} ${h === 1 ? "hora" : "horas"}`);
    if (m > 0) parts.push(`${m} ${m === 1 ? "minuto" : "minutos"}`);
    if (s > 0 && h === 0) parts.push(`${s} ${s === 1 ? "segundo" : "segundos"}`);
    if (parts.length === 0) return "zero segundos";
    return parts.join(" e ");
  } else {
    const parts: string[] = [];
    if (h > 0) parts.push(`${h} ${h === 1 ? "hour" : "hours"}`);
    if (m > 0) parts.push(`${m} ${m === 1 ? "minute" : "minutes"}`);
    if (s > 0 && h === 0) parts.push(`${s} ${s === 1 ? "second" : "seconds"}`);
    if (parts.length === 0) return "zero seconds";
    return parts.join(" and ");
  }
}

/**
 * Monta o anúncio falado completo com base nas opções ativas do usuário.
 */
export function buildVoiceCoachAnnouncement(
  stats: VoiceCoachStats,
  config: VoiceCoachConfig,
  lang: "pt" | "en" = "pt"
): string {
  const phrases: string[] = [];

  // 1. Distância
  if (config.speakDistance && stats.distanceM > 0) {
    const distText = formatDistanceForSpeech(stats.distanceM, lang);
    if (distText) {
      phrases.push(lang === "pt" ? `Distância: ${distText}.` : `Distance: ${distText}.`);
    }
  }

  // 2. Tempo total
  if (config.speakTime && stats.elapsedSec > 0) {
    const timeText = formatDurationForSpeech(stats.elapsedSec, lang);
    if (timeText) {
      phrases.push(lang === "pt" ? `Tempo: ${timeText}.` : `Time: ${timeText}.`);
    }
  }

  // 3. Ritmo Médio
  if (config.speakAvgPace && stats.avgPaceSecKm && stats.avgPaceSecKm > 0) {
    const paceText = formatPaceForSpeech(stats.avgPaceSecKm, lang);
    if (paceText) {
      phrases.push(lang === "pt" ? `Ritmo médio: ${paceText}.` : `Average pace: ${paceText}.`);
    }
  }

  // 4. Ritmo Atual (Instantâneo)
  if (config.speakCurrentPace && stats.currentPaceSecKm && stats.currentPaceSecKm > 0) {
    const currPaceText = formatPaceForSpeech(stats.currentPaceSecKm, lang);
    if (currPaceText) {
      phrases.push(lang === "pt" ? `Ritmo atual: ${currPaceText}.` : `Current pace: ${currPaceText}.`);
    }
  }

  // 5. Split do Último KM (se completou 1km recentemente)
  if (config.speakLastSplit && stats.lastSplitKm && stats.lastSplitPaceSecKm) {
    const splitPace = formatPaceForSpeech(stats.lastSplitPaceSecKm, lang);
    if (splitPace) {
      phrases.push(
        lang === "pt"
          ? `Quilômetro ${stats.lastSplitKm} em ${splitPace}.`
          : `Kilometer ${stats.lastSplitKm} in ${splitPace}.`
      );
    }
  }

  // 6. Frequência Cardíaca & Zona
  if (stats.heartRate && stats.heartRate > 0) {
    if (config.speakHeartRate) {
      phrases.push(
        lang === "pt"
          ? `Frequência cardíaca: ${Math.round(stats.heartRate)} batimentos por minuto.`
          : `Heart rate: ${Math.round(stats.heartRate)} beats per minute.`
      );
    }
    if (config.speakHeartRateZone && stats.heartRateZoneName) {
      phrases.push(
        lang === "pt"
          ? `Zona atual: ${stats.heartRateZoneName}.`
          : `Current zone: ${stats.heartRateZoneName}.`
      );
    }
  }

  return phrases.join(" ");
}

/**
 * Executa a síntese de voz usando SpeechSynthesisUtterance.
 */
export function speakWithConfig(
  text: string,
  config: VoiceCoachConfig,
  lang: "pt" | "en" = "pt"
): void {
  if (typeof window === "undefined" || !window.speechSynthesis || !text.trim()) {
    return;
  }

  try {
    // Interrompe falas anteriores para não encavalar
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const targetLang = lang === "pt" ? "pt-BR" : "en-US";
    utterance.lang = targetLang;
    utterance.rate = Math.max(0.6, Math.min(2.0, config.speechRate ?? 1.0));
    utterance.pitch = Math.max(0.5, Math.min(1.5, config.speechPitch ?? 1.0));
    utterance.volume = Math.max(0.1, Math.min(1.0, config.speechVolume ?? 1.0));

    // Busca voz compatível no dispositivo se disponível
    const voices = window.speechSynthesis.getVoices?.();
    if (voices && voices.length > 0) {
      const preferred = voices.find(
        (v) => v.lang === targetLang || v.lang.startsWith(lang === "pt" ? "pt" : "en")
      );
      if (preferred) {
        utterance.voice = preferred;
      }
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn("Erro ao executar síntese de voz (Voice Coach):", err);
  }
}

/**
 * Toca uma demonstração da voz com as configurações atuais.
 */
export function playVoiceCoachPreview(config: VoiceCoachConfig, lang: "pt" | "en" = "pt"): void {
  const sampleStats: VoiceCoachStats = {
    distanceM: 3000,
    elapsedSec: 930, // 15m 30s
    avgPaceSecKm: 310, // 5:10/km
    currentPaceSecKm: 305,
    heartRate: 154,
    heartRateZoneName: lang === "pt" ? "Z3, Ritmo Moderado" : "Z3, Moderate Pace",
    lastSplitKm: 3,
    lastSplitPaceSecKm: 302,
  };

  const text = buildVoiceCoachAnnouncement(sampleStats, config, lang);
  const fallback =
    lang === "pt"
      ? "Olá corredor! Este é o teste do seu Assistente de Voz do RunFlow. Bom treino!"
      : "Hello runner! This is a test of your RunFlow Voice Coach. Have a great run!";

  speakWithConfig(text || fallback, config, lang);
}
