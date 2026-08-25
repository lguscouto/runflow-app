export const ELEVATION_CONSENT_KEY = "runflow:external-elevation-consent";

export function hasElevationConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(ELEVATION_CONSENT_KEY) === "granted";
  } catch {
    return false;
  }
}

export function grantElevationConsent(): void {
  try {
    window.sessionStorage.setItem(ELEVATION_CONSENT_KEY, "granted");
  } catch {
    // A chamada pública continuará protegida quando o storage estiver indisponível.
  }
}

export function requireElevationConsent(): void {
  if (!hasElevationConsent()) {
    throw new Error("External elevation consent required");
  }
}
