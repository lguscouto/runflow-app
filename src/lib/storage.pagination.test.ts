import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  putActivity,
  listStoredActivitiesPaged,
  resetStoreForTesting,
} from "./storage";
import { generateSyntheticActivities } from "../../tests/fixtures/datasets";

describe("Storage Cursor Pagination", () => {
  beforeEach(async () => {
    await resetStoreForTesting(true);
  });

  afterEach(async () => {
    await resetStoreForTesting(true);
  });

  it("paginates seamlessly across pages using stable cursor", async () => {
    const dataset = generateSyntheticActivities(120);
    for (const act of dataset) {
      await putActivity(act);
    }

    // Página 1 (50 itens)
    const page1 = await listStoredActivitiesPaged(50, null);
    expect(page1.items).toHaveLength(50);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBeDefined();

    // Página 2 (50 itens)
    const page2 = await listStoredActivitiesPaged(50, page1.nextCursor);
    expect(page2.items).toHaveLength(50);
    expect(page2.hasMore).toBe(true);
    expect(page2.nextCursor).toBeDefined();

    // Página 3 (20 itens finais)
    const page3 = await listStoredActivitiesPaged(50, page2.nextCursor);
    expect(page3.items).toHaveLength(20);
    expect(page3.hasMore).toBe(false);
    expect(page3.nextCursor).toBeNull();

    // Garante que não há IDs duplicados entre as páginas
    const allIds = [
      ...page1.items.map((i) => i.id),
      ...page2.items.map((i) => i.id),
      ...page3.items.map((i) => i.id),
    ];
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(120);
  });
});
