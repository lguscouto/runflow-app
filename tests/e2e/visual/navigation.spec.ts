import { expect, test, type Page } from "@playwright/test";
import { installRuntimeGuard } from "../helpers/runtimeGuard";
import { seedIndexedDb } from "../helpers/seedIndexedDb";
import {
  assertMinimumTargetSize,
  assertNoHorizontalOverflow,
  assertStableScreenshot,
  assertVisibleKeyboardFocus,
} from "../helpers/visualAssertions";

const VIEWPORTS = [
  { width: 360, height: 640 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 480, height: 1040 },
  { width: 600, height: 960 },
  { width: 800, height: 1280 },
  { width: 844, height: 390 },
  { width: 1280, height: 800 },
] as const;
const SHELL_TARGET_SELECTOR = "header a, header button, nav a, nav button";

function viewportName(viewport: (typeof VIEWPORTS)[number]): string {
  return `${viewport.width}x${viewport.height}`;
}

async function openSeededHome(page: Page) {
  await page.goto("/");
  await seedIndexedDb(page);
  await expect(page.getByRole("heading", { name: "Olá, E2E Synthetic User!" })).toBeVisible();
  await expect(page.locator("header")).toBeVisible();
  await expect(page.locator("nav:visible")).toHaveCount(1);
}

test.describe("RunFlow shell navigation and responsive visual matrix", () => {
  for (const viewport of VIEWPORTS) {
    const name = viewportName(viewport);

    test(`${name} navega entre Início e Atividades no shell`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const runtime = installRuntimeGuard(page);

      await openSeededHome(page);
      const navigation = page.locator("nav:visible");
      await navigation.getByRole("link", { name: "Atividades", exact: true }).click();
      await expect(page).toHaveURL(/\/atividades\/?$/);
      await expect(page.getByRole("heading", { name: "Atividades" })).toBeVisible();
      await expect(page.getByText("Nenhum treino ainda.")).toBeVisible();

      await page.locator("nav:visible").getByRole("link", { name: "Início", exact: true }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole("heading", { name: "Olá, E2E Synthetic User!" })).toBeVisible();

      runtime.assertClean();
    });

    test(`${name} não tem overflow, mantém foco/targets e screenshot estáveis`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const runtime = installRuntimeGuard(page);

      await openSeededHome(page);
      await assertNoHorizontalOverflow(page);
      await assertVisibleKeyboardFocus(page);
      await assertStableScreenshot(page, `shell-${name}`);
      await assertMinimumTargetSize(page, { selector: SHELL_TARGET_SELECTOR });

      runtime.assertClean();
    });
  }
});

test("alterna o modo claro e preserva a preferência após reload", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const runtime = installRuntimeGuard(page);

  await openSeededHome(page);

  const lightToggle = page.getByRole("button", { name: "Ativar modo claro" });
  await expect(lightToggle).toBeVisible();
  await lightToggle.click();
  await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("light");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator("body")).toHaveCSS("color", "rgb(24, 24, 27)");
  await expect(page.getByRole("button", { name: "Ativar modo escuro" })).toBeVisible();

  await page.reload();
  await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("light");
  await expect(page.getByRole("button", { name: "Ativar modo escuro" })).toBeVisible();

  runtime.assertClean();
});
