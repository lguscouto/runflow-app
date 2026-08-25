import { describe, expect, it } from "vitest";
import { measureFlyoverBudget, selectFlyoverQuality } from "./quality";

describe("Flyover 3D quality budget", () => {
  it("measures the render workload from DPR, antialiasing, and segments", () => {
    const base = measureFlyoverBudget({
      width: 800,
      height: 500,
      devicePixelRatio: 1,
      antialias: false,
      segments: 600,
    });
    const higherDpr = measureFlyoverBudget({
      width: 800,
      height: 500,
      devicePixelRatio: 2,
      antialias: false,
      segments: 600,
    });
    const antialiased = measureFlyoverBudget({
      width: 800,
      height: 500,
      devicePixelRatio: 1,
      antialias: true,
      segments: 600,
    });
    const denser = measureFlyoverBudget({
      width: 800,
      height: 500,
      devicePixelRatio: 1,
      antialias: false,
      segments: 1_200,
    });

    expect(higherDpr.pixelCount).toBe(base.pixelCount * 4);
    expect(antialiased.antialiasFactor).toBeGreaterThan(base.antialiasFactor);
    expect(denser.segmentFactor).toBeGreaterThan(base.segmentFactor);
    expect(higherDpr.workUnits).toBeGreaterThan(base.workUnits);
    expect(antialiased.workUnits).toBeGreaterThan(base.workUnits);
    expect(denser.workUnits).toBeGreaterThan(base.workUnits);
  });

  it("chooses a tier from measured inputs, not from a device-memory hint", () => {
    const request = {
      width: 1_920,
      height: 1_080,
      devicePixelRatio: 3,
      antialias: true,
      segments: 1_500,
    } as const;

    const lowMemory = selectFlyoverQuality({ ...request, deviceMemory: 2 });
    const highMemory = selectFlyoverQuality({ ...request, deviceMemory: 64 });

    expect(lowMemory.tier).toBe("low");
    expect(highMemory.tier).toBe(lowMemory.tier);
    expect(highMemory.budget.workUnits).toBe(lowMemory.budget.workUnits);
    expect(lowMemory.antialias).toBe(false);
    expect(lowMemory.segments).toBeLessThan(request.segments);
    expect(lowMemory.pixelRatio).toBeLessThan(request.devicePixelRatio);
  });

  it("reduces only the measured expensive dimensions for a balanced budget", () => {
    const quality = selectFlyoverQuality({
      width: 1_200,
      height: 800,
      devicePixelRatio: 2,
      antialias: true,
      segments: 1_500,
    });

    expect(quality.tier).toBe("balanced");
    expect(quality.antialias).toBe(false);
    expect(quality.pixelRatio).toBe(1.5);
    expect(quality.segments).toBe(900);
  });
});
