import { expect, test, type Page } from "@playwright/test";
import { installRuntimeGuard } from "../helpers/runtimeGuard";

const syntheticProfile = {
  name: "E2E Synthetic User",
  onboarded: true,
  language: "pt",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

async function seedSyntheticDataset(page: Page, count: number) {
  await page.goto("/");
  await page.waitForFunction(
    async () => {
      const factory = indexedDB as IDBFactory & {
        databases?: () => Promise<Array<{ name?: string; version?: number }>>;
      };
      if (typeof factory.databases !== "function") return true;
      const databases = await factory.databases();
      return databases.some(
        (database) => database.name === "runflow" && (database.version ?? 0) >= 7,
      );
    },
    undefined,
    { timeout: 10_000 },
  );
  await page.evaluate(
    ({ count, profile }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("runflow");
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("Synthetic RunFlow database open was blocked"));
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(
            ["profile", "activitySummaries", "activityTracks"],
            "readwrite",
          );
          transaction.objectStore("profile").put(profile, "user");
          const summaries = transaction.objectStore("activitySummaries");
          const tracks = transaction.objectStore("activityTracks");

          for (let index = 0; index < count; index += 1) {
            const id = `e2e-synthetic-${index.toString().padStart(4, "0")}`;
            const startedAt = new Date(
              Date.UTC(2026, 0, 1) - index * 86_400_000,
            ).toISOString();
            summaries.put({
              id,
              name: `Corrida Sintética #${index + 1}`,
              sport: "running",
              startedAt,
              durationSec: 1_800,
              movingTimeSec: 1_740,
              elapsedTimeSec: 1_800,
              distanceM: 5_000,
              avgPaceSecKm: 360,
              avgSpeedKmh: 10,
              maxSpeedKmh: 12,
              avgWatts: null,
              maxWatts: null,
              normalizedPowerWatts: null,
              vamMh: null,
              maxGradePercent: null,
              avgCadenceRpm: null,
              maxCadenceRpm: null,
              elevationGainM: 25,
              avgHr: 145,
              calories: 400,
              source: "synthetic-test",
              fileName: null,
              gearId: null,
              routeId: null,
              workoutId: null,
            });
            tracks.put({
              id,
              points: [
                { lat: -22.9, lng: -43.2, timestamp: startedAt },
                { lat: -22.901, lng: -43.201, timestamp: startedAt },
              ],
              maxPaceSecKm: null,
              maxHr: 160,
              notes: null,
              workoutId: null,
              structuredWorkoutReport: null,
            });
          }

          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error);
        };
      }),
    { count, profile: syntheticProfile },
  );
}

test.describe("histórico com dados sintéticos", () => {
  for (const count of [0, 25, 1000]) {
    test(`renderiza o histórico sem overflow com ${count} atividades`, async ({ page }) => {
      const runtime = installRuntimeGuard(page);
      await seedSyntheticDataset(page, count);
      await page.goto("/atividades/");

      await expect(page.getByRole("heading", { name: "Atividades" })).toBeVisible();
      await expect(
        page.getByText(`${count} treino(s) registrado(s)`, { exact: true }),
      ).toBeVisible();

      if (count === 0) {
        await expect(page.getByText("Nenhum treino ainda.")).toBeVisible();
      } else {
        await expect(page.getByText("Corrida Sintética #1", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Gráficos e Estatísticas" }).click();
        await expect(page.getByText("Período", { exact: true })).toBeVisible();
        await expect(page.getByText("Atividade", { exact: true })).toBeVisible();
      }

      const noHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      expect(noHorizontalOverflow).toBe(true);
      runtime.assertClean();
    });
  }
});
