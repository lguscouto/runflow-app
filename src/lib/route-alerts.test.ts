import { describe, expect, it } from "vitest";
import { shouldAnnounceOffRoute } from "./route-alerts";

describe("route alert throttling", () => {
  it("announces transitions and throttles repeated off-route updates", () => {
    expect(shouldAnnounceOffRoute(false, false, 0, 30_000)).toBe(false);
    expect(shouldAnnounceOffRoute(true, false, 0, 30_000)).toBe(true);
    expect(shouldAnnounceOffRoute(true, true, 10_000, 30_000)).toBe(false);
    expect(shouldAnnounceOffRoute(true, true, 30_000, 30_000)).toBe(true);
  });
});