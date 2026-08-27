import { expect, test } from "@playwright/test";
import { installRuntimeGuard } from "../helpers/runtimeGuard";
import { seedOnboardedProfile } from "../helpers/seedIndexedDb";

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

  await page.goto("/");
  await seedOnboardedProfile(page);
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
