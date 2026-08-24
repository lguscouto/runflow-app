import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getStoredActivity,
  getAllStoredSummaries,
  getAllStoredActivities,
  resetStoreForTesting,
} from "./storage";
import { createLegacyDbV5 } from "../../tests/fixtures/legacyDbV5";
import { createLegacyDbV6 } from "../../tests/fixtures/legacyDbV6";
import {
  makeStoredActivity,
  makeStructuredWorkoutReport,
} from "../../tests/fixtures/activityFactory";

describe("IndexedDB v7 Atomic Migration", () => {
  beforeEach(async () => {
    await resetStoreForTesting(true);
  });

  afterEach(async () => {
    await resetStoreForTesting(true);
  });

  it("migrates from v5 legacy database losslessly", async () => {
    const report = makeStructuredWorkoutReport({ workoutId: "w-v5" });
    const legacyActivity = makeStoredActivity({
      id: "v5-activity-01",
      name: "Treino do Banco V5",
      workoutId: "w-v5",
      structuredWorkoutReport: report,
      notes: "Criado originalmente no schema v5",
    });

    // Cria banco no schema v5
    await createLegacyDbV5("runflow", [legacyActivity]);

    // Ao invocar as funções normais do app, o upgrade v7 é acionado
    const summaries = await getAllStoredSummaries();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].id).toBe("v5-activity-01");
    expect(summaries[0].name).toBe("Treino do Banco V5");

    const full = await getStoredActivity("v5-activity-01");
    expect(full).toBeDefined();
    expect(full?.workoutId).toBe("w-v5");
    expect(full?.notes).toBe("Criado originalmente no schema v5");
    expect(full?.structuredWorkoutReport).toEqual(report);
    expect(full?.points).toHaveLength(3);
  });

  it("migrates from v6 legacy database losslessly", async () => {
    const report = makeStructuredWorkoutReport({ workoutId: "w-v6" });
    const legacyActivity = makeStoredActivity({
      id: "v6-activity-01",
      name: "Treino do Banco V6",
      workoutId: "w-v6",
      structuredWorkoutReport: report,
    });

    // Cria banco no schema v6
    await createLegacyDbV6("runflow", [legacyActivity]);

    const full = await getStoredActivity("v6-activity-01");
    expect(full).toBeDefined();
    expect(full?.id).toBe("v6-activity-01");
    expect(full?.name).toBe("Treino do Banco V6");
  });

  it("reconstructs all stored activities correctly", async () => {
    const legacyActivity1 = makeStoredActivity({
      id: "act-batch-1",
      startedAt: "2026-08-24T10:00:00.000Z",
    });
    const legacyActivity2 = makeStoredActivity({
      id: "act-batch-2",
      startedAt: "2026-08-24T12:00:00.000Z",
    });

    await createLegacyDbV5("runflow", [legacyActivity1, legacyActivity2]);

    const all = await getAllStoredActivities();
    expect(all).toHaveLength(2);
    // Ordenado por startedAt desc
    expect(all[0].id).toBe("act-batch-2");
    expect(all[1].id).toBe("act-batch-1");
    expect(all[0].points).toBeDefined();
  });
});
