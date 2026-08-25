import type { VoiceCoachConfig, Sport } from "@/lib/types";
import { Capacitor, registerPlugin } from "@capacitor/core";

interface NativeSpeechPlugin {
  speak(options: {
    text: string;
    lang: string;
    rate: number;
    pitch: number;
    volume: number;
  }): Promise<void>;
  stop(): Promise<void>;
}

const NativeSpeech = registerPlugin<NativeSpeechPlugin>("NativeSpeech");

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
  speakSpeedKmh: true,
  speakCurrentSpeedKmh: false,
  speakCadence: true,
  speakPowerWatts: true,
  speakElevationGain: true,
  speechRate: 1.0,
  speechPitch: 1.0,
  speechVolume: 1.0,
};

export interface VoiceCoachStats {
  sport?: Sport;
  distanceM: number;
  elapsedSec: number;
  avgPaceSecKm?: number | null;
  currentPaceSecKm?: number | null;
  avgSpeedKmh?: number | null;
  currentSpeedKmh?: number | null;
  cadenceRpm?: number | null;
  powerWatts?: number | null;
  elevationGainM?: number | null;
  heartRate?: number | null;
  heartRateZoneName?: string | null;
  lastSplitKm?: number | null;
  lastSplitPaceSecKm?: number | null;
  lastSplitSpeedKmh?: number | null;
}

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function getUsableSpeechSynthesis(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  const synthesis = window.speechSynthesis;
  if (
    !synthesis ||
    typeof synthesis.cancel !== "function" ||
    typeof synthesis.speak !== "function" ||
    typeof SpeechSynthesisUtterance !== "function"
  ) {
    return null;
  }
  return synthesis;
}

function clampSpeechSetting(
  value: number | null | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, safeValue));
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
 * Converte velocidade em km/h em texto fonético natural.
 */
export function formatSpeedForSpeech(speedKmh: number, lang: "pt" | "en" = "pt"): string {
  if (!speedKmh || isNaN(speedKmh) || !isFinite(speedKmh) || speedKmh <= 0) return "";
  const rounded = speedKmh.toFixed(1);
  if (lang === "pt") {
    const formatted = rounded.replace(".", " vírgula ");
    return `${formatted} quilômetros por hora`;
  } else {
    return `${rounded} kilometers per hour`;
  }
}

/**
 * Converte cadência em RPM em texto fonético natural.
 */
export function formatCadenceForSpeech(rpm: number, lang: "pt" | "en" = "pt"): string {
  if (!rpm || isNaN(rpm) || !isFinite(rpm) || rpm <= 0) return "";
  const rounded = Math.round(rpm);
  if (lang === "pt") {
    return `${rounded} rotações por minuto`;
  } else {
    return `${rounded} RPM`;
  }
}

/**
 * Converte potência em Watts em texto fonético natural.
 */
export function formatPowerForSpeech(watts: number, lang: "pt" | "en" = "pt"): string {
  if (!watts || isNaN(watts) || !isFinite(watts) || watts <= 0) return "";
  const rounded = Math.round(watts);
  return `${rounded} watts`;
}

/**
 * Converte ganho de elevação em metros em texto fonético natural.
 */
export function formatElevationGainForSpeech(gainM: number, lang: "pt" | "en" = "pt"): string {
  if (!gainM || isNaN(gainM) || !isFinite(gainM) || gainM <= 0) return "";
  const rounded = Math.round(gainM);
  if (lang === "pt") {
    return `${rounded} ${rounded === 1 ? "metro" : "metros"} de elevação`;
  } else {
    return `${rounded} ${rounded === 1 ? "meter" : "meters"} elevation gain`;
  }
}

/**
 * Converte distância em metros em fala fluida.
 */
export function formatDistanceForSpeech(distanceM: number, lang: "pt" | "en" = "pt"): string {
  if (!Number.isFinite(distanceM) || distanceM <= 0) return "";
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
  if (!Number.isFinite(totalSec) || totalSec < 0) return "";
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
 * Monta o anúncio falado completo com base nas opções ativas do usuário e no esporte praticado.
 */
export function buildVoiceCoachAnnouncement(
  stats: VoiceCoachStats,
  config: VoiceCoachConfig,
  lang: "pt" | "en" = "pt"
): string {
  const phrases: string[] = [];
  const isCycling = stats.sport === "cycling";

  // 1. Distância
  if (config.speakDistance && isPositiveFinite(stats.distanceM)) {
    const distText = formatDistanceForSpeech(stats.distanceM, lang);
    if (distText) {
      phrases.push(lang === "pt" ? `Distância: ${distText}.` : `Distance: ${distText}.`);
    }
  }

  // 2. Tempo total
  if (config.speakTime && isPositiveFinite(stats.elapsedSec)) {
    const timeText = formatDurationForSpeech(stats.elapsedSec, lang);
    if (timeText) {
      phrases.push(lang === "pt" ? `Tempo: ${timeText}.` : `Time: ${timeText}.`);
    }
  }

  // 3. Velocidade Média (Ciclismo) ou Ritmo Médio (Corrida/Caminhada)
  if (isCycling) {
    if (config.speakAvgPace !== false && isPositiveFinite(stats.avgSpeedKmh)) {
      const speedText = formatSpeedForSpeech(stats.avgSpeedKmh, lang);
      if (speedText) {
        phrases.push(lang === "pt" ? `Velocidade média: ${speedText}.` : `Average speed: ${speedText}.`);
      }
    }
  } else {
    if (config.speakAvgPace && isPositiveFinite(stats.avgPaceSecKm)) {
      const paceText = formatPaceForSpeech(stats.avgPaceSecKm, lang);
      if (paceText) {
        phrases.push(lang === "pt" ? `Ritmo médio: ${paceText}.` : `Average pace: ${paceText}.`);
      }
    }
  }

  // 4. Velocidade Atual (Ciclismo) ou Ritmo Atual (Corrida/Caminhada)
  if (isCycling) {
    if (config.speakCurrentSpeedKmh && isPositiveFinite(stats.currentSpeedKmh)) {
      const currSpeedText = formatSpeedForSpeech(stats.currentSpeedKmh, lang);
      if (currSpeedText) {
        phrases.push(lang === "pt" ? `Velocidade atual: ${currSpeedText}.` : `Current speed: ${currSpeedText}.`);
      }
    }
  } else {
    if (config.speakCurrentPace && isPositiveFinite(stats.currentPaceSecKm)) {
      const currPaceText = formatPaceForSpeech(stats.currentPaceSecKm, lang);
      if (currPaceText) {
        phrases.push(lang === "pt" ? `Ritmo atual: ${currPaceText}.` : `Current pace: ${currPaceText}.`);
      }
    }
  }

  // 5. Split do Último KM
  if (config.speakLastSplit && isPositiveFinite(stats.lastSplitKm)) {
    if (isCycling && isPositiveFinite(stats.lastSplitSpeedKmh)) {
      const splitSpeed = formatSpeedForSpeech(stats.lastSplitSpeedKmh, lang);
      if (splitSpeed) {
        phrases.push(
          lang === "pt"
            ? `Quilômetro ${stats.lastSplitKm} a ${splitSpeed}.`
            : `Kilometer ${stats.lastSplitKm} at ${splitSpeed}.`
        );
      }
    } else if (isPositiveFinite(stats.lastSplitPaceSecKm)) {
      const splitPace = formatPaceForSpeech(stats.lastSplitPaceSecKm, lang);
      if (splitPace) {
        phrases.push(
          lang === "pt"
            ? `Quilômetro ${stats.lastSplitKm} em ${splitPace}.`
            : `Kilometer ${stats.lastSplitKm} in ${splitPace}.`
        );
      }
    }
  }

  // 6. Cadência (RPM)
  if (config.speakCadence && isPositiveFinite(stats.cadenceRpm)) {
    const cadText = formatCadenceForSpeech(stats.cadenceRpm, lang);
    if (cadText) {
      phrases.push(lang === "pt" ? `Cadência: ${cadText}.` : `Cadence: ${cadText}.`);
    }
  }

  // 7. Potência (Watts)
  if (config.speakPowerWatts && isPositiveFinite(stats.powerWatts)) {
    const powerText = formatPowerForSpeech(stats.powerWatts, lang);
    if (powerText) {
      phrases.push(lang === "pt" ? `Potência: ${powerText}.` : `Power: ${powerText}.`);
    }
  }

  // 8. Ganho de Elevação
  if (config.speakElevationGain && isPositiveFinite(stats.elevationGainM)) {
    const elevText = formatElevationGainForSpeech(stats.elevationGainM, lang);
    if (elevText) {
      phrases.push(lang === "pt" ? `Ganho de elevação: ${elevText}.` : `Elevation gain: ${elevText}.`);
    }
  }

  // 9. Frequência Cardíaca & Zona
  if (isPositiveFinite(stats.heartRate)) {
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

export function cancelVoiceCoachSpeech(): void {
  if (typeof window === "undefined") return;
  try {
    const speechSynthesis = getUsableSpeechSynthesis();
    if (speechSynthesis) {
      speechSynthesis.cancel();
    } else if (Capacitor.isNativePlatform()) {
      NativeSpeech.stop().catch(() => {});
    }
  } catch {
    // Silently ignore when the platform speech engine is unavailable.
  }
}

/**
 * Executa a síntese de voz usando SpeechSynthesisUtterance.
 */
export function speakWithConfig(
  text: string,
  config: VoiceCoachConfig,
  lang: "pt" | "en" = "pt"
): void {
  if (typeof window === "undefined" || !text.trim()) {
    return;
  }

  const targetLang = lang === "pt" ? "pt-BR" : "en-US";
  const rate = clampSpeechSetting(config.speechRate, 1.0, 0.6, 2.0);
  const pitch = clampSpeechSetting(config.speechPitch, 1.0, 0.5, 1.5);
  const volume = clampSpeechSetting(config.speechVolume, 1.0, 0.1, 1.0);

  const speechSynthesis = getUsableSpeechSynthesis();
  if (!speechSynthesis) {
    if (Capacitor.isNativePlatform()) {
      try {
        NativeSpeech.speak({ text, lang: targetLang, rate, pitch, volume }).catch((err) => {
          console.warn("Erro ao executar TTS nativo (Voice Coach):", err);
        });
      } catch (err) {
        console.warn("Erro ao iniciar TTS nativo (Voice Coach):", err);
      }
    }
    return;
  }

  try {
    // Interrompe falas anteriores para não encavalar
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = targetLang;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    // Busca voz compatível no dispositivo se disponível
    const voices = speechSynthesis.getVoices?.();
    if (voices && voices.length > 0) {
      const preferred = voices.find(
        (v) => v.lang === targetLang || v.lang.startsWith(lang === "pt" ? "pt" : "en")
      );
      if (preferred) {
        utterance.voice = preferred;
      }
    }

    speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn("Erro ao executar síntese de voz (Voice Coach):", err);
  }
}

/**
 * Toca uma demonstração da voz com as configurações atuais.
 */
export function playVoiceCoachPreview(
  config: VoiceCoachConfig,
  lang: "pt" | "en" = "pt",
  sport: Sport = "running"
): void {
  const isCycling = sport === "cycling";
  const sampleStats: VoiceCoachStats = isCycling
    ? {
        sport: "cycling",
        distanceM: 10000,
        elapsedSec: 1260, // 21m 00s
        avgSpeedKmh: 28.6,
        currentSpeedKmh: 31.2,
        cadenceRpm: 88,
        powerWatts: 215,
        elevationGainM: 140,
        heartRate: 148,
        heartRateZoneName: lang === "pt" ? "Z3, Ritmo Moderado" : "Z3, Moderate Pace",
        lastSplitKm: 10,
        lastSplitSpeedKmh: 30.5,
      }
    : {
        sport: "running",
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
      ? isCycling
        ? "Olá ciclista! Este é o teste do seu Assistente de Voz do RunFlow. Bom pedal!"
        : "Olá corredor! Este é o teste do seu Assistente de Voz do RunFlow. Bom treino!"
      : isCycling
      ? "Hello cyclist! This is a test of your RunFlow Voice Coach. Have a great ride!"
      : "Hello runner! This is a test of your RunFlow Voice Coach. Have a great run!";

  speakWithConfig(text || fallback, config, lang);
}

/**
 * Constrói anúncio falado de aproximação de subida.
 */
export function buildClimbApproachAnnouncement(
  climbNumber: number,
  totalClimbs: number,
  category: string,
  distanceToStartM: number,
  climbLengthM: number,
  avgGradePct: number,
  lang: "pt" | "en" = "pt"
): string {
  if (![climbNumber, totalClimbs, distanceToStartM, climbLengthM, avgGradePct].every(Number.isFinite)) {
    return "";
  }
  const distKm = (climbLengthM / 1000).toFixed(1).replace(".", ",");
  const gradeStr = avgGradePct.toFixed(1).replace(".", ",");

  if (lang === "pt") {
    const catText = category === "HC" ? "Fora de Categoria" : category === "Uncategorized" ? "Rampa" : category;
    return `Atenção: subida à frente em ${Math.round(distanceToStartM)} metros. Subida ${climbNumber} de ${totalClimbs}, ${catText}. ${distKm} quilômetros a ${gradeStr} por cento de inclinação média.`;
  } else {
    const catText = category === "HC" ? "Hors Categorie" : category === "Uncategorized" ? "Short Climb" : category;
    const distKmEn = (climbLengthM / 1000).toFixed(1);
    const gradeStrEn = avgGradePct.toFixed(1);
    return `Attention: climb ahead in ${Math.round(distanceToStartM)} meters. Climb ${climbNumber} of ${totalClimbs}, ${catText}. ${distKmEn} kilometers at ${gradeStrEn} percent average gradient.`;
  }
}

/**
 * Constrói anúncio falado de início de subida.
 */
export function buildClimbStartAnnouncement(
  climbNumber: number,
  totalClimbs: number,
  category: string,
  climbLengthM: number,
  avgGradePct: number,
  lang: "pt" | "en" = "pt"
): string {
  if (![climbNumber, totalClimbs, climbLengthM, avgGradePct].every(Number.isFinite)) {
    return "";
  }
  const distKm = (climbLengthM / 1000).toFixed(1).replace(".", ",");
  const gradeStr = avgGradePct.toFixed(1).replace(".", ",");

  if (lang === "pt") {
    const catText = category === "HC" ? "Fora de Categoria" : category === "Uncategorized" ? "Rampa" : category;
    return `Início da subida ${climbNumber} de ${totalClimbs}. ${catText}, ${distKm} quilômetros até o cume com média de ${gradeStr} por cento. Força nas pernas!`;
  } else {
    const catText = category === "HC" ? "Hors Categorie" : category === "Uncategorized" ? "Short Climb" : category;
    const distKmEn = (climbLengthM / 1000).toFixed(1);
    const gradeStrEn = avgGradePct.toFixed(1);
    return `Start of climb ${climbNumber} of ${totalClimbs}. ${catText}, ${distKmEn} kilometers to the summit with ${gradeStrEn} percent average gradient. Push hard!`;
  }
}

/**
 * Constrói anúncio falado de conclusão de subida (topo alcançado).
 */
export function buildClimbCompletedAnnouncement(
  climbNumber: number,
  totalClimbs: number,
  elevationGainM: number,
  lang: "pt" | "en" = "pt"
): string {
  if (![climbNumber, totalClimbs, elevationGainM].every(Number.isFinite)) {
    return "";
  }
  if (lang === "pt") {
    return `Excelente! Subida ${climbNumber} de ${totalClimbs} concluída. Ganho de ${Math.round(elevationGainM)} metros de elevação alcançado.`;
  } else {
    return `Great job! Climb ${climbNumber} of ${totalClimbs} completed. ${Math.round(elevationGainM)} meters of elevation gain achieved.`;
  }
}
