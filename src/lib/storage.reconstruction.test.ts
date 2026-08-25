import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { openDB } from "idb";
import {
  getStoredActivity,
  putActivity,
  resetStoreForTesting,
} from "./storage";
import {
  makeStoredActivity,
  makeStructuredWorkoutReport,
} from "../../tests/fixtures/activityFactory";

describe("split-store reconstruction contract", () => {
  beforeEach(async () => {
    await resetStoreForTesting(true);
  });

  afterEach(async () => {
    await resetStoreForTesting(true);
  });

  it("reconstructs the complete detail from lightweight summary plus track", async () => {
    const report = makeStructuredWorkoutReport({ workoutId: "contract-workout" });
    const activity = makeStoredActivity({
      id: "contract-activity",
      workoutId: "contract-workout",
      structuredWorkoutReport: report,
      notes: "nota preservada",
    });

    await putActivity(activity);

    const db = await openDB("runflow");
    const summary = await db.get("activitySummaries", activity.id);
    const track = await db.get("activityTracks", activity.id);
    db.close();

    expect(summary).toBeDefined();
    expect(summary).not.toHaveProperty("points");
    expect(summary).not.toHaveProperty("structuredWorkoutReport");
    expect(track?.points).toEqual(activity.points);
    expect(track?.structuredWorkoutReport).toEqual(report);
    expect(await getStoredActivity(activity.id)).toEqual(activity);
  });
});
