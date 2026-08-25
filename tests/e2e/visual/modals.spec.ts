import { expect, test, type Locator, type Page } from "@playwright/test";
import { installRuntimeGuard } from "../helpers/runtimeGuard";

async function seedOnboardedProfile(page: Page) {
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

async function assertFocusIsTrapped(page: Page, dialog: Locator) {
  const focusable = dialog.locator(
    'button:not([disabled]), a[href]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  const count = await focusable.count();
  expect(count).toBeGreaterThan(1);

  const first = focusable.first();
  const last = focusable.last();

  await last.focus();
  await page.keyboard.press("Tab");
  await expect(first).toBeFocused();

  await first.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(last).toBeFocused();
}

test("mantém foco confinado e restaura o gatilho nos modais de configurações", async ({ page }) => {
  const runtime = installRuntimeGuard(page);

  await page.goto("/");
  await seedOnboardedProfile(page);
  await page.goto("/perfil");
  await expect(page.getByRole("heading", { name: "Seu perfil" })).toBeVisible();

  const voiceTrigger = page.getByRole("button", { name: /Ajustes da Voz/ });
  await voiceTrigger.click();
  const voiceDialog = page.getByRole("dialog", {
    name: "Assistente de Voz (Audio Cues)",
  });
  await expect(voiceDialog).toBeVisible();
  await assertFocusIsTrapped(page, voiceDialog);

  await page.keyboard.press("Escape");
  await expect(voiceDialog).not.toBeVisible();
  await expect(voiceTrigger).toBeFocused();

  const autoPauseTrigger = page.getByRole("button", { name: /Ajustes Auto-Pause/ });
  await autoPauseTrigger.click();
  const autoPauseDialog = page.getByRole("dialog", { name: "Auto-Pause Inteligente" });
  await expect(autoPauseDialog).toBeVisible();
  await assertFocusIsTrapped(page, autoPauseDialog);

  await page.keyboard.press("Escape");
  await expect(autoPauseDialog).not.toBeVisible();
  await expect(autoPauseTrigger).toBeFocused();

  runtime.assertClean();
});
