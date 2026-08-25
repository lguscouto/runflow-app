export const OFF_ROUTE_ALERT_INTERVAL_MS = 30_000;

export function shouldAnnounceOffRoute(
  isOffRoute: boolean,
  wasOffRoute: boolean,
  elapsedSinceLastAlertMs: number,
  intervalMs: number = OFF_ROUTE_ALERT_INTERVAL_MS
): boolean {
  if (!isOffRoute) return false;
  if (!wasOffRoute) return true;
  return Number.isFinite(elapsedSinceLastAlertMs) && elapsedSinceLastAlertMs >= intervalMs;
}
