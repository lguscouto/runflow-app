import { describe, it, expect } from "vitest";
import { douglasPeucker, simplifyPoints, haversineM, distanceFromPoints } from "./geo";

describe("Iterative Douglas-Peucker & GPS Utilities", () => {
  it("should handle edge cases: 0, 1, and 2 points", () => {
    expect(douglasPeucker([])).toEqual([]);
    const single = [{ lat: -23.5, lng: -46.6 }];
    expect(douglasPeucker(single)).toEqual(single);
    const twoPoints = [
      { lat: -23.5, lng: -46.6 },
      { lat: -23.6, lng: -46.7 },
    ];
    expect(douglasPeucker(twoPoints)).toEqual(twoPoints);
  });

  it("should simplify collinear points down to start and end", () => {
    // 5 collinear points along a straight line
    const collinear = [
      { lat: 0.0, lng: 0.0 },
      { lat: 0.0, lng: 0.001 },
      { lat: 0.0, lng: 0.002 },
      { lat: 0.0, lng: 0.003 },
      { lat: 0.0, lng: 0.004 },
    ];
    const simplified = douglasPeucker(collinear, 2.0);
    expect(simplified).toHaveLength(2);
    expect(simplified[0]).toEqual(collinear[0]);
    expect(simplified[1]).toEqual(collinear[4]);
  });

  it("should preserve significant corners and curves", () => {
    // A 90-degree corner
    const corner = [
      { lat: -23.5500, lng: -46.6333 },
      { lat: -23.5500, lng: -46.6340 }, // straight
      { lat: -23.5500, lng: -46.6350 }, // corner peak
      { lat: -23.5510, lng: -46.6350 }, // turn 90 deg
      { lat: -23.5520, lng: -46.6350 },
    ];
    const simplified = douglasPeucker(corner, 3.0);
    // Should preserve the corner vertex
    expect(simplified.some((p) => p.lat === -23.5500 && p.lng === -46.6350)).toBe(true);
  });

  it("should process 50,000 synthetic GPS points without stack overflow", () => {
    const points: Array<{ lat: number; lng: number }> = [];
    let lat = -23.55;
    let lng = -46.63;
    for (let i = 0; i < 50000; i++) {
      // Simulate running track with small perturbations and turns every 500 points
      lat += 0.00001 * Math.sin(i / 100);
      lng += 0.00001 * Math.cos(i / 100);
      points.push({ lat, lng });
    }

    const start = performance.now();
    const simplified = simplifyPoints(points, 800);
    const durationMs = performance.now() - start;

    expect(simplified.length).toBeLessThanOrEqual(800);
    expect(simplified.length).toBeGreaterThan(10);
    expect(durationMs).toBeLessThan(500); // Super fast execution
  });

  it("should calculate accurate Haversine distance", () => {
    // Distance between 2 points roughly 111 meters apart (0.001 deg latitude)
    const dist = haversineM(0.0, 0.0, 0.001, 0.0);
    expect(dist).toBeGreaterThan(110);
    expect(dist).toBeLessThan(112);
  });
});
