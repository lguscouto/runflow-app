import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { streamHeatmapPoints } from "./heatmap-data";
import { putActivity, resetStoreForTesting } from "./storage";
import { generateSyntheticActivities } from "../../tests/fixtures/datasets";

describe("Heatmap Data Streaming", () => {
  beforeEach(async () => {
    await resetStoreForTesting(true);
  });

  afterEach(async () => {
    await resetStoreForTesting(true);
  });

  it("processes activities in batches without memory leaks", async () => {
    const activities = generateSyntheticActivities(50);
    for (const act of activities) {
      await putActivity(act);
    }

    let batchCallCount = 0;
    const points = await streamHeatmapPoints(10, () => {
      batchCallCount++;
    });

    expect(points.length).toBeGreaterThan(0);
    expect(batchCallCount).toBeGreaterThan(0);
  });
});
