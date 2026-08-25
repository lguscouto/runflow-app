import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { forEachHeatmapBatch } from "./heatmap-data";
import { putActivity, resetStoreForTesting } from "./storage";
import { generateSyntheticActivities } from "../../tests/fixtures/datasets";

describe("Heatmap Data Streaming", () => {
  beforeEach(async () => {
    await resetStoreForTesting(true);
  });

  afterEach(async () => {
    await resetStoreForTesting(true);
  });

  it("streams bounded simplified track batches and returns lightweight metadata", async () => {
    const activities = generateSyntheticActivities(50);
    for (const act of activities) {
      await putActivity(act);
    }

    const batchSizes: number[] = [];
    const batchReferences: unknown[] = [];
    const result = await forEachHeatmapBatch(
      { batchSize: 10 },
      async (batch) => {
        batchSizes.push(batch.length);
        batchReferences.push(batch);
      },
    );

    expect(Math.max(...batchSizes)).toBeLessThanOrEqual(10);
    expect(new Set(batchReferences).size).toBe(batchReferences.length);
    expect(result).toEqual({
      activities: 50,
      renderedPoints: expect.any(Number),
      availableYears: expect.any(Array),
    });
    expect(Object.keys(result).sort()).toEqual([
      "activities",
      "availableYears",
      "renderedPoints",
    ]);
  });

  it("stops reading when the consumer aborts the signal", async () => {
    const activities = generateSyntheticActivities(30);
    for (const act of activities) {
      await putActivity(act);
    }

    const controller = new AbortController();
    let consumed = 0;
    await expect(
      forEachHeatmapBatch(
        { batchSize: 5, signal: controller.signal },
        async () => {
          consumed += 1;
          controller.abort();
        },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(consumed).toBe(1);
  });

});
