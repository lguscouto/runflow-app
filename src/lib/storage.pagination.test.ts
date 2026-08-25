import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  putActivity,
  listStoredActivitiesPaged,
  removeActivity,
  resetStoreForTesting,
} from "./storage";
import { generateSyntheticActivities } from "../../tests/fixtures/datasets";
import { makeStoredActivity } from "../../tests/fixtures/activityFactory";

describe("Storage Cursor Pagination", () => {
  beforeEach(async () => {
    await resetStoreForTesting(true);
  });

  afterEach(async () => {
    await resetStoreForTesting(true);
  });

  it("rejects limits outside the bounded pagination contract", async () => {
    await expect(listStoredActivitiesPaged(0)).rejects.toThrow(RangeError);
    await expect(listStoredActivitiesPaged(-1)).rejects.toThrow(RangeError);
    await expect(listStoredActivitiesPaged(201)).rejects.toThrow(RangeError);
    await expect(listStoredActivitiesPaged(1.5)).rejects.toThrow(RangeError);
  });

  it("returns an empty terminal page for an empty database", async () => {
    await expect(listStoredActivitiesPaged(50)).resolves.toEqual({
      items: [],
      nextCursor: null,
      hasMore: false,
    });
  });

  it("continues after a removed cursor using the compound key position", async () => {
    const startedAt = "2026-08-24T12:00:00.000Z";
    const dataset = ["a", "b", "c", "d", "e"].map((id) =>
      makeStoredActivity({ id: `same-date-${id}`, startedAt }),
    );
    for (const activity of dataset) {
      await putActivity(activity);
    }

    const firstPage = await listStoredActivitiesPaged(2);
    expect(firstPage.items.map((item) => item.id)).toEqual([
      "same-date-e",
      "same-date-d",
    ]);
    const removedCursor = firstPage.nextCursor;
    expect(removedCursor).toEqual({ startedAt, id: "same-date-d" });
    await removeActivity("same-date-d");

    const secondPage = await listStoredActivitiesPaged(2, removedCursor);
    expect(secondPage.items.map((item) => item.id)).toEqual([
      "same-date-c",
      "same-date-b",
    ]);
  });

  it("paginates seamlessly across pages using stable cursor", async () => {
    const dataset = generateSyntheticActivities(120);
    for (const act of dataset) {
      await putActivity(act);
    }

    const page1 = await listStoredActivitiesPaged(50, null);
    expect(page1.items).toHaveLength(50);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBeDefined();

    const page2 = await listStoredActivitiesPaged(50, page1.nextCursor);
    expect(page2.items).toHaveLength(50);
    expect(page2.hasMore).toBe(true);
    expect(page2.nextCursor).toBeDefined();

    const page3 = await listStoredActivitiesPaged(50, page2.nextCursor);
    expect(page3.items).toHaveLength(20);
    expect(page3.hasMore).toBe(false);
    expect(page3.nextCursor).toBeNull();

    const allIds = [
      ...page1.items.map((i) => i.id),
      ...page2.items.map((i) => i.id),
      ...page3.items.map((i) => i.id),
    ];
    expect(new Set(allIds).size).toBe(120);
  });
});
