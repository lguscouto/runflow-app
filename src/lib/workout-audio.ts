import type { FlatWorkoutStep, VoiceCoachConfig } from "./types";
import { cancelVoiceCoachSpeech, formatPaceForSpeech, speakWithConfig } from "./voice-coach";
import { resolveStepPowerTargetWatts, formatStepCadenceRange } from "./structured-workout";
import { DEFAULT_FTP_WATTS } from "./power-zones";

let audioCtx: AudioContext | null = null;
let pendingChimeTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSpeechTimer: ReturnType<typeof setTimeout> | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioCtx?.state === "closed") {
    audioCtx = null;
  }
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function stopWorkoutAudio(): void {
  if (pendingChimeTimer !== null) {
    clearTimeout(pendingChimeTimer);
    pendingChimeTimer = null;
  }
  if (pendingSpeechTimer !== null) {
    clearTimeout(pendingSpeechTimer);
    pendingSpeechTimer = null;
  }

  cancelVoiceCoachSpeech();

  const context = audioCtx;
  audioCtx = null;
  if (context && context.state !== "closed") {
    context.close().catch(() => {});
  }
}


/**
 * Toca um bip sonoro com frequência e duração configuráveis.
 */
export function playWorkoutBeep(freq = 880, durationMs = 150, type: OscillatorType = "sine") {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch (err) {
    console.error("Erro ao tocar bip de treino:", err);
  }
}

/**
 * Bip de contagem regressiva curta (ex: 3, 2, 1).
 */
export function playCountdownPip() {
  playWorkoutBeep(660, 100, "sine");
}

/**
 * Bip agudo de início de bloco (GO!).
 */
export function playStartBlockChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Dois bips rápidos ascendentes
    playWorkoutBeep(880, 120, "triangle");
    if (pendingChimeTimer !== null) {
      clearTimeout(pendingChimeTimer);
    }
    pendingChimeTimer = setTimeout(() => {
      pendingChimeTimer = null;
      playWorkoutBeep(1320, 200, "triangle");
    }, 120);
  } catch (err) {
    console.error("Erro ao tocar chime de início:", err);
  }
}

/**
 * Constrói o texto falado de anúncio da transição de etapa do treino.
 */
export function buildStepAnnouncement(
  flatStep: FlatWorkoutStep,
  lang: "pt" | "en" = "pt",
  userFtp: number = DEFAULT_FTP_WATTS
): string {
  const { step, repeatIndex, totalRepeats } = flatStep;
  const isPt = lang === "pt";

  let stepName = step.name || "";
  let targetStr = "";

  if (step.targetType === "distance") {
    const m = step.targetValue;
    if (m >= 1000) {
      const km = (m / 1000).toFixed(1).replace(".0", "").replace(".", ",");
      targetStr = isPt ? `${km} quilômetros` : `${km} kilometers`;
    } else {
      targetStr = isPt ? `${m} metros` : `${m} meters`;
    }
  } else if (step.targetType === "time") {
    const s = step.targetValue;
    const min = Math.floor(s / 60);
    const sec = s % 60;
    if (min > 0 && sec > 0) {
      targetStr = isPt ? `${min} minutos e ${sec} segundos` : `${min} minutes and ${sec} seconds`;
    } else if (min > 0) {
      targetStr = isPt ? `${min} minutos` : `${min} minutes`;
    } else {
      targetStr = isPt ? `${sec} segundos` : `${sec} seconds`;
    }
  }

  let repeatPrefix = "";
  if (repeatIndex && totalRepeats) {
    if (step.type === "work") {
      repeatPrefix = isPt
        ? `Tiro ${repeatIndex} de ${totalRepeats}. `
        : `Interval ${repeatIndex} of ${totalRepeats}. `;
    } else if (step.type === "recovery") {
      repeatPrefix = isPt
        ? `Recuperação ${repeatIndex} de ${totalRepeats}. `
        : `Recovery ${repeatIndex} of ${totalRepeats}. `;
    }
  } else if (!stepName) {
    if (step.type === "warmup") stepName = isPt ? "Aquecimento" : "Warm up";
    else if (step.type === "work") stepName = isPt ? "Tiro forte" : "Fast interval";
    else if (step.type === "recovery") stepName = isPt ? "Recuperação" : "Recovery";
    else if (step.type === "cooldown") stepName = isPt ? "Desaquecimento" : "Cool down";
  }

  let paceTargetStr = "";
  if (step.paceTarget?.maxPaceSecKm) {
    const paceSpoken = formatPaceForSpeech(step.paceTarget.maxPaceSecKm, lang);
    paceTargetStr = isPt ? `. Ritmo alvo abaixo de ${paceSpoken}` : `. Target pace below ${paceSpoken}`;
  }

  // Alvo de Potência (Watts / FTP)
  let powerTargetStr = "";
  const powerResolved = resolveStepPowerTargetWatts(step, userFtp);
  if (powerResolved) {
    if (powerResolved.zone) {
      powerTargetStr = isPt
        ? `. Zona ${powerResolved.zone}, em torno de ${Math.round((powerResolved.minWatts + powerResolved.maxWatts) / 2)} Watts`
        : `. Zone ${powerResolved.zone}, around ${Math.round((powerResolved.minWatts + powerResolved.maxWatts) / 2)} Watts`;
    } else {
      powerTargetStr = isPt
        ? `. Potência alvo entre ${powerResolved.minWatts} e ${powerResolved.maxWatts} Watts`
        : `. Target power between ${powerResolved.minWatts} and ${powerResolved.maxWatts} Watts`;
    }
  }

  // Alvo de Cadência (RPM)
  let cadenceTargetStr = "";
  if (step.cadenceTarget) {
    const { minCadenceRpm, maxCadenceRpm, targetCadenceRpm } = step.cadenceTarget;
    if (minCadenceRpm && maxCadenceRpm) {
      cadenceTargetStr = isPt
        ? `. Cadência entre ${minCadenceRpm} e ${maxCadenceRpm} rotações por minuto`
        : `. Cadence between ${minCadenceRpm} and ${maxCadenceRpm} RPM`;
    } else if (targetCadenceRpm) {
      cadenceTargetStr = isPt
        ? `. Cadência de ${targetCadenceRpm} rotações por minuto`
        : `. Cadence ${targetCadenceRpm} RPM`;
    }
  }

  const parts = [repeatPrefix || `${stepName}. `, targetStr, paceTargetStr, powerTargetStr, cadenceTargetStr].filter(Boolean);
  return parts.join("");
}

/**
 * Anuncia a etapa por voz usando a configuração do Voice Coach.
 */
export function speakWorkoutStep(
  flatStep: FlatWorkoutStep,
  config: VoiceCoachConfig,
  lang: "pt" | "en" = "pt",
  userFtp: number = DEFAULT_FTP_WATTS
) {
  playStartBlockChime();
  const text = buildStepAnnouncement(flatStep, lang, userFtp);
  if (pendingSpeechTimer !== null) {
    clearTimeout(pendingSpeechTimer);
  }
  pendingSpeechTimer = setTimeout(() => {
    pendingSpeechTimer = null;
    speakWithConfig(text, config, lang);
  }, 350);
}