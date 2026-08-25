import { describe, expect, it } from "vitest";
import {
  LONG_ENGLISH_TEXT,
  LONG_PORTUGUESE_TEXT,
  makeNullHeavyActivity,
  makeStructuredWorkout,
  makeStructuredWorkoutReport,
  makeLongTextActivity,
} from "./activityFactory";
import { makeSyntheticProfile } from "./profile";
import {
  generateSyntheticRoutes,
  makeSyntheticRoute,
} from "./routes";
import {
  generateEqualDateSummaries,
  generateSyntheticActivities,
  generateSyntheticGpsPoints,
  generateSyntheticSummaries,
  GPS_POINT_COUNTS,
  makeSyntheticActivityWithPoints,
  makeSyntheticBike,
  makeSyntheticGear,
  SUMMARY_COUNTS,
} from "./datasets";

describe("synthetic fixture datasets", () => {
  it("generates deterministic summaries with equal timestamps", () => {
    const first = generateEqualDateSummaries(25);
    const second = generateEqualDateSummaries(25);

    expect(first).toHaveLength(25);
    expect(new Set(first.map((summary) => summary.startedAt)).size).toBe(1);
    expect(first).toEqual(second);
  });

  it("keeps structured workout report steps consistent with its totals", () => {
    const report = makeStructuredWorkoutReport();

    expect(report.steps).toHaveLength(report.totalSteps);
    expect(report.completedSteps).toBeLessThanOrEqual(report.totalSteps);
    expect(report.complianceRatePercent).toBe(100);
    expect(report.steps.map((step) => step.stepIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  it("generates deterministic GPS points with valid coordinates", () => {
    for (const count of GPS_POINT_COUNTS) {
      const first = generateSyntheticGpsPoints(count);
      const second = generateSyntheticGpsPoints(count);

      expect(first).toHaveLength(count);
      expect(first).toEqual(second);
      expect(first.every((point) => Number.isFinite(point.lat))).toBe(true);
      expect(first.every((point) => Number.isFinite(point.lng))).toBe(true);
    }
  });

  it("builds a stored activity around a requested GPS dataset size", () => {
    const activity = makeSyntheticActivityWithPoints(10_000);

    expect(activity.source).toBe("synthetic-test");
    expect(activity.points).toHaveLength(10_000);
    expect(activity.id).toBe("activity-gps-10000");
  });

  it("covers the supported summary dataset sizes without personal data", () => {
    for (const count of SUMMARY_COUNTS) {
      const summaries = generateSyntheticSummaries(count);
      const ids = new Set(summaries.map((summary) => summary.id));

      expect(summaries).toHaveLength(count);
      expect(ids).toHaveLength(count);
      expect(summaries.every((summary) => summary.source === "synthetic-test")).toBe(
        true
      );
    }
  });

  it("rejects negative and fractional synthetic dataset sizes", () => {
    expect(() => generateSyntheticActivities(-1)).toThrow(RangeError);
    expect(() => generateSyntheticSummaries(1.5)).toThrow(RangeError);
    expect(() => generateSyntheticGpsPoints(-1)).toThrow(RangeError);
  });

  it("provides long deterministic Portuguese and English strings", () => {
    expect(LONG_PORTUGUESE_TEXT.length).toBeGreaterThan(500);
    expect(LONG_ENGLISH_TEXT.length).toBeGreaterThan(500);
    expect(LONG_PORTUGUESE_TEXT).toContain("treino");
    expect(LONG_ENGLISH_TEXT).toContain("workout");
    expect(LONG_PORTUGUESE_TEXT).toBe(LONG_PORTUGUESE_TEXT);
    expect(LONG_ENGLISH_TEXT).toBe(LONG_ENGLISH_TEXT);
  });

  it("places the long strings in activity notes for both locales", () => {
    const portuguese = makeLongTextActivity("pt");
    const english = makeLongTextActivity("en");

    expect(portuguese.notes).toBe(LONG_PORTUGUESE_TEXT);
    expect(english.notes).toBe(LONG_ENGLISH_TEXT);
    expect(portuguese.source).toBe("synthetic-test");
    expect(english.source).toBe("synthetic-test");
  });

  it("keeps a valid activity fixture with explicit nullable fields", () => {
    const activity = makeNullHeavyActivity();

    expect(activity.source).toBe("synthetic-test");
    expect(activity.distanceM).toBe(0);
    expect(activity.avgPaceSecKm).toBeNull();
    expect(activity.avgSpeedKmh).toBeNull();
    expect(activity.avgWatts).toBeNull();
    expect(activity.avgHr).toBeNull();
    expect(activity.calories).toBeNull();
    expect(activity.fileName).toBeNull();
    expect(activity.gearId).toBeNull();
    expect(activity.routeId).toBeNull();
    expect(activity.workoutId).toBeNull();
    expect(activity.structuredWorkoutReport).toBeNull();
    expect(activity.points).toEqual([]);
  });

  it("provides a deterministic structured workout fixture", () => {
    const first = makeStructuredWorkout();
    const second = makeStructuredWorkout();

    expect(first).toEqual(second);
    expect(first.id).toBe("workout-synthetic-01");
    expect(first.items.length).toBeGreaterThan(1);
    expect(first.items.some((item) => item.type === "repeat")).toBe(true);
    expect(first.sport).toBe("running");
  });

  it("provides synthetic equipment with stable identity and mileage", () => {
    const gear = makeSyntheticGear();

    expect(gear).toEqual(makeSyntheticGear());
    expect(gear.id).toBe("gear-synthetic-shoes");
    expect(gear.type).toBe("shoes");
    expect(gear.status).toBe("active");
    expect(gear.initialDistanceM).toBe(0);
  });

  it("provides a synthetic bike with cycling-specific equipment data", () => {
    const bike = makeSyntheticBike();

    expect(bike.id).toBe("gear-synthetic-bike");
    expect(bike.type).toBe("bike");
    expect(bike.bikeType).toBe("road");
    expect(bike.weightKg).toBeGreaterThan(0);
    expect(bike.components?.length).toBeGreaterThan(0);
  });

  it("provides deterministic routes with usable points and unique ids", () => {
    const route = makeSyntheticRoute();
    const routes = generateSyntheticRoutes(3);

    expect(route).toEqual(makeSyntheticRoute());
    expect(route.id).toBe("route-synthetic-01");
    expect(route.points.length).toBeGreaterThan(1);
    expect(route.distanceM).toBeGreaterThan(0);
    expect(route.source).toBe("drawn");
    expect(new Set(routes.map((item) => item.id))).toHaveLength(3);
    expect(routes.every((item) => item.source === "drawn")).toBe(true);
    expect(() => generateSyntheticRoutes(-1)).toThrow(RangeError);
  });

  it("provides a deterministic synthetic profile without contact data", () => {
    const profile = makeSyntheticProfile();

    expect(profile).toEqual(makeSyntheticProfile());
    expect(profile.name).toBe("Perfil sintético");
    expect(profile.language).toBe("pt");
    expect(profile.updatedAt).toBe("2026-08-20T12:00:00.000Z");
    expect(JSON.stringify(profile)).not.toMatch(/@|\\+?\\d[\\d ()-]{7,}/);
  });

  it("does not embed personal identifiers in the synthetic fixtures", () => {
    const serialized = JSON.stringify({
      activity: makeLongTextActivity("pt"),
      emptyActivity: makeNullHeavyActivity(),
      summaries: generateSyntheticSummaries(25),
      points: generateSyntheticGpsPoints(1_000),
      route: makeSyntheticRoute(),
      profile: makeSyntheticProfile(),
      gear: makeSyntheticGear(),
      bike: makeSyntheticBike(),
    });

    expect(serialized).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/i);
    expect(serialized).not.toMatch(
      /(?:cpf|cnh|telefone|phone|e-?mail)\\s*[:=]/i
    );
    expect(serialized).not.toMatch(/Gustavo|Maria|João|John Doe/i);
  });
});
