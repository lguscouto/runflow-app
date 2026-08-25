import { expect, type Page } from "@playwright/test";

export interface HorizontalOverflowMetrics {
  viewportWidth: number;
  documentWidth: number;
  bodyWidth: number;
}

export interface TargetSizeIssue {
  label: string;
  href: string | null;
  width: number;
  height: number;
}

export interface MinimumTargetOptions {
  selector?: string;
  minWidth?: number;
  minHeight?: number;
}

export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  });

  const metrics = await page.evaluate<HorizontalOverflowMetrics>(() => {
    const documentElement = document.documentElement;
    const body = document.body;

    return {
      viewportWidth: documentElement.clientWidth,
      documentWidth: documentElement.scrollWidth,
      bodyWidth: body?.scrollWidth ?? 0,
    };
  });

  const renderedWidth = Math.max(metrics.documentWidth, metrics.bodyWidth);
  expect(
    renderedWidth,
    `Horizontal overflow at ${metrics.viewportWidth}px: document=${metrics.documentWidth}px body=${metrics.bodyWidth}px`,
  ).toBeLessThanOrEqual(metrics.viewportWidth);
}

export async function assertMinimumTargetSize(
  page: Page,
  {
    selector = "nav a, nav button",
    minWidth = 48,
    minHeight = 48,
  }: MinimumTargetOptions = {},
): Promise<void> {
  const undersizedTargets = await page.locator(selector).evaluateAll(
    (elements, minimums: { minWidth: number; minHeight: number }) =>
      elements
        .filter((element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0" &&
            rect.width > 0 &&
            rect.height > 0
          );
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            label:
              element.getAttribute("aria-label") ??
              element.textContent?.replace(/\s+/g, " ").trim() ??
              element.getAttribute("href") ??
              element.tagName,
            href: element.getAttribute("href"),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        })
        .filter(({ width, height }) => width < minimums.minWidth || height < minimums.minHeight),
    { minWidth, minHeight },
  );

  expect(
    undersizedTargets,
    `Interactive targets must be at least ${minWidth}x${minHeight}px`,
  ).toEqual([]);
}

export async function assertVisibleKeyboardFocus(page: Page): Promise<void> {
  await page.evaluate(() => {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
  });
  await page.keyboard.press("Tab");

  const focusState = await page.evaluate(() => {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement)) {
      return {
        active: false,
        focusVisible: false,
        indicator: false,
        label: "no HTMLElement focused",
      };
    }

    const style = window.getComputedStyle(activeElement);
    const outlineWidth = Number.parseFloat(style.outlineWidth) || 0;
    const outlineColor = style.outlineColor;
    const hasVisibleOutline =
      style.outlineStyle !== "none" &&
      outlineWidth > 0 &&
      outlineColor !== "transparent" &&
      !outlineColor.endsWith(", 0)");
    const hasVisibleShadow = style.boxShadow !== "none" && !style.boxShadow.endsWith(", 0px)");
    const rect = activeElement.getBoundingClientRect();

    return {
      active: activeElement !== document.body,
      focusVisible: activeElement.matches(":focus-visible"),
      indicator: hasVisibleOutline || hasVisibleShadow,
      label:
        activeElement.getAttribute("aria-label") ??
        activeElement.textContent?.replace(/\s+/g, " ").trim() ??
        activeElement.tagName,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
      boxShadow: style.boxShadow,
    };
  });

  expect(focusState.active, `Tab did not focus an interactive shell element: ${focusState.label}`).toBe(true);
  expect(focusState.focusVisible, `Keyboard focus is not focus-visible on ${focusState.label}`).toBe(true);
  expect(
    focusState.indicator,
    `Keyboard focus has no visible outline or shadow on ${focusState.label}`,
  ).toBe(true);
}

export async function assertStableScreenshot(page: Page, label: string): Promise<void> {
  await page.addStyleTag({
    content: `
      *,
      *::before,
      *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `,
  });
  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  });

  const screenshotOptions = {
    animations: "disabled" as const,
    caret: "hide" as const,
    fullPage: false,
    scale: "css" as const,
  };
  const first = await page.screenshot(screenshotOptions);
  const second = await page.screenshot(screenshotOptions);

  expect(first.length, `Screenshot ${label} was empty`).toBeGreaterThan(0);
  expect(
    second.equals(first),
    `Screenshot ${label} changed between identical captures; freeze animations or wait for stable UI state`,
  ).toBe(true);
}
