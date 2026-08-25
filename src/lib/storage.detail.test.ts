import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDB } from "idb";
import {
  putActivity,
  getStoredActivity,
  resetStoreForTesting,
} from "./storage";
import {
  makeStoredActivity,
  makeStructuredWorkoutReport,
} from "../../tests/fixtures/activityFactory";

describe("Storage Detail Preservation", () => {
  beforeEach(async () => {
    await resetStoreForTesting(true);
  });

  afterEach(async () => {
    await resetStoreForTesting(true);
  });

  it("preserves structured workout metadata in detail storage", async () => {
    const report = makeStructuredWorkoutReport({
      workoutId: "workout-42",
      workoutName: "Tiro 10x 400m",
      complianceRatePercent: 92,
    });

    const activity = makeStoredActivity({
      id: "act-structured-01",
      workoutId: "workout-42",
      structuredWorkoutReport: report,
      notes: "Treino intenso, cumpriu as parciais.",
    });

    await putActivity(activity);

    const db = await openDB("runflow");
    const summary = await db.get("activitySummaries", activity.id);
    const track = await db.get("activityTracks", activity.id);
    db.close();

    expect(summary).toBeDefined();
    expect(summary).not.toHaveProperty("structuredWorkoutReport");
    expect(track?.structuredWorkoutReport).toEqual(report);

    const restored = await getStoredActivity(activity.id);
    expect(restored).toBeDefined();
    expect(restored?.id).toBe("act-structured-01");
    expect(restored?.workoutId).toBe("workout-42");
    expect(restored?.notes).toBe("Treino intenso, cumpriu as parciais.");
    expect(restored?.structuredWorkoutReport).toEqual(report);
    expect(restored?.structuredWorkoutReport?.complianceRatePercent).toBe(92);
  });
});
