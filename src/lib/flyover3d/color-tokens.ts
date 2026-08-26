/**
 * Tokens exclusivos do renderer Three.js do flyover.
 *
 * Este módulo fica no caminho lazy do Flyover3D. Não importar o catálogo
 * compartilhado aqui evita que o pacote Three.js volte ao chunk inicial.
 */
export const flyover3dColorTokens = {
  background: "#0b0e14",
  light: "#ffffff",
  backLight: "#0284c7",
  grid: "#1e293b",
  ground: "#07090e",
  tubeEmissive: "#051515",
  start: "#10b981",
  startEmissive: "#059669",
  end: "#ef4444",
  endEmissive: "#d97706",
  runner: "#38bdf8",
  runnerEmissive: "#0284c7",
  runnerRgb: [0.06, 0.72, 0.5],
} as const;
