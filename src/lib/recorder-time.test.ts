import { describe, expect, it } from "vitest";
import { calculateElapsedSec, calculateMovingSec } from "./recorder-time";

describe("recorder elapsed time", () => {
  it("stops elapsed time at the pause boundary", () => {
    expect(calculateElapsedSec(0, 20_000, "paused", 10_000, 0)).toBe(10);
  });

  it("excludes a completed pause when stopping immediately", () => {
    expect(calculateElapsedSec(0, 20_000, "saving", undefined, 10_000)).toBe(10);
  });

  it("derives moving time from the active clock instead of interval tick count", () => {
    expect(calculateMovingSec(20, 20_000)).toBe(20);
  });

  it("subtracts completed and ongoing auto-pause time from active elapsed time", () => {
    expect(calculateMovingSec(20, 20_000, undefined, 5_000)).toBe(15);
    expect(calculateMovingSec(20, 20_000, 15_000, 0)).toBe(15);
  });
});
