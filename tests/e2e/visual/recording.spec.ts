import { expect, test, type Page } from "@playwright/test";
import { installRuntimeGuard } from "../helpers/runtimeGuard";

async function seedOnboardedProfile(page: Page) {
  await page.goto("/");
  await page.evaluate(
    () =>
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
          transaction.onabort = () => reject(transaction.error);
        };
      }),
  );
}

test("inicia, pausa e retoma a gravação sem erro de runtime", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: -22.9, longitude: -43.2 });
  await page.route("https://*.tile.openstreetmap.org/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  });
  const runtime = installRuntimeGuard(page, {
    ignoreFailedRequest: (request) =>
      request.method() === "GET" &&
      request.url().includes(".tile.openstreetmap.org/") &&
      request.failure()?.errorText === "net::ERR_ABORTED",
  });

  await seedOnboardedProfile(page);
  await page.reload();
  await page.goto("/gravar/");
  await expect(page.getByRole("heading", { name: "Iniciar treino" })).toBeVisible();

  await page.getByRole("button", { name: /Iniciar/i }).click();
  await expect(page.getByRole("button", { name: "Pausar" })).toBeVisible();

  await page.getByRole("button", { name: "Pausar" }).click();
  await expect(page.getByRole("button", { name: "Retomar" })).toBeVisible();

  await page.getByRole("button", { name: "Retomar" }).click();
  await expect(page.getByRole("button", { name: "Pausar" })).toBeVisible();
  runtime.assertClean();
});
