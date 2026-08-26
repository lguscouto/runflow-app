import confetti from "canvas-confetti";
import { colorTokens } from "./color-tokens";
import { haptics } from "./haptics";

/**
 * Dispara confetes comemorativos ao bater um Recorde Pessoal (PR).
 */
export function firePRConfetti() {
  haptics.success();

  try {
    if (typeof window === "undefined") return;

    confetti({
      particleCount: 45,
      spread: 55,
      origin: { y: 0.7 },
      zIndex: 9999,
      disableForReducedMotion: true,
      colors: [...colorTokens.celebration.achievements],
    });
  } catch (err) {
    console.warn("Erro ao disparar confetes PR:", err);
  }
}

/**
 * Dispara confetes comemorativos ao concluir um treino ou atingir meta semanal.
 */
export function fireWorkoutCompletedConfetti() {
  haptics.success();

  try {
    if (typeof window === "undefined") return;

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
      zIndex: 9999,
      disableForReducedMotion: true,
      colors: [...colorTokens.celebration.streak],
    });
  } catch (err) {
    console.warn("Erro ao disparar confetes de treino:", err);
  }
}

/**
 * Dispara celebração de chamas / estrelas ao manter a sequência de semanas (Streak).
 */
export function fireStreakConfetti() {
  haptics.success();

  try {
    if (typeof window === "undefined") return;

    confetti({
      particleCount: 40,
      spread: 55,
      origin: { y: 0.6 },
      zIndex: 9999,
      disableForReducedMotion: true,
      colors: [...colorTokens.celebration.milestone],
      shapes: ["circle", "square"],
      scalar: 1.0,
    });
  } catch (err) {
    console.warn("Erro ao disparar confetes streak:", err);
  }
}
