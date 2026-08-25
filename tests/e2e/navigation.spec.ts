import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import { installRuntimeGuard } from "./helpers/runtimeGuard";

async function seedOnboardedProfile(page: import("@playwright/test").Page) {
  await page.evaluate(() =>
    new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("runflow");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction("profile", "readwrite");
        transaction.objectStore("profile").put(
          {
            name: "E2E Synthetic User",
            onboarded: true,
            language: "pt",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
          "user",
        );
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    }),
  );
  await page.reload();
}

test("navega pela home e pela lista vazia via HTTP", async ({ page }) => {
  const runtime = installRuntimeGuard(page);

  await page.goto("/");
  await seedOnboardedProfile(page);
  await expect(page.getByRole("heading", { name: "Olá, E2E Synthetic User!" })).toBeVisible();

  await page.getByRole("link", { name: "Atividades", exact: true }).first().click();
  await expect(page).toHaveURL(/\/atividades\/?$/);
  await expect(page.getByRole("heading", { name: "Atividades" })).toBeVisible();
  await expect(page.getByText("Nenhum treino ainda.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Importar treino", exact: true })).toBeVisible();

  runtime.assertClean();
});

test("carrega a página inicial pelo artefato file://", async ({ browser }) => {
  const context = await browser.newContext({
    locale: "pt-BR",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const runtime = installRuntimeGuard(page);
  const fileUrl = pathToFileURL(path.resolve(process.cwd(), "out", "index.html")).href;

  await page.goto(fileUrl);
  await expect(page.getByRole("heading", { name: "Seus treinos de corrida" })).toBeVisible();
  runtime.assertClean();

  await context.close();
});
