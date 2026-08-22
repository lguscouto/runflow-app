import confetti from "canvas-confetti";
import { haptics } from "./haptics";

/**
 * Dispara confetes comemorativos ao bater um Recorde Pessoal (PR).
 */
export function firePRConfetti() {
  haptics.success();

  const count = 200;
  const defaults = {
    origin: { y: 0.7 },
    zIndex: 9999,
  };

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  }

  fire(0.25, {
    spread: 26,
    startVelocity: 55,
    colors: ["#ff4500", "#ffa500", "#ffd700"],
  });
  fire(0.2, {
    spread: 60,
    colors: ["#00f2fe", "#4facfe", "#00c6ff"],
  });
  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8,
    colors: ["#ff007f", "#7928ca", "#ff0080"],
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2,
    colors: ["#10b981", "#34d399", "#6ee7b7"],
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 45,
    colors: ["#ffd700", "#ffb703", "#fb8500"],
  });
}

/**
 * Dispara confetes comemorativos ao concluir um treino ou atingir meta semanal.
 */
export function fireWorkoutCompletedConfetti() {
  haptics.success();

  const end = Date.now() + 1000;
  const colors = ["#ff5722", "#00e676", "#00b0ff", "#ffeb3b"];

  (function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: colors,
      zIndex: 9999,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: colors,
      zIndex: 9999,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();
}

/**
 * Dispara celebração de chamas / estrelas ao manter a sequência de semanas (Streak).
 */
export function fireStreakConfetti() {
  haptics.success();

  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#ff4500", "#ff8c00", "#ffd700", "#ff0055"],
    zIndex: 9999,
    shapes: ["circle", "square"],
    scalar: 1.1,
  });
}
