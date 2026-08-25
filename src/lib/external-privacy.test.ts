// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  ELEVATION_CONSENT_KEY,
  grantElevationConsent,
  hasElevationConsent,
} from "./external-privacy";

describe("external elevation privacy", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("denies Open-Meteo access until explicit session consent", () => {
    expect(hasElevationConsent()).toBe(false);

    grantElevationConsent();

    expect(window.sessionStorage.getItem(ELEVATION_CONSENT_KEY)).toBe("granted");
    expect(hasElevationConsent()).toBe(true);
  });
});
