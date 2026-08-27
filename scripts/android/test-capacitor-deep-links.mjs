import { chromium } from "@playwright/test";

const routes = [
  { path: "/", search: "" },
  { path: "/gravar/", search: "" },
  { path: "/atividades/", search: "" },
  { path: "/atividades/ver/", search: "?id=deep-link-test" },
  { path: "/importar/", search: "" },
  { path: "/rotas/", search: "" },
  { path: "/perfil/", search: "" },
  { path: "/heatmap/", search: "" },
];
const cdpUrl = process.env.RUNFLOW_CDP_URL ?? "http://127.0.0.1:9222";
const waitAfterNavigationMs = 1800;

async function snapshot(page, route) {
  return page.evaluate((route) => ({
    route: route.path,
    search: route.search,
    expectedPath: route.path === "/" ? "/" : `${route.path}index.html`,
    expectedSearch: route.search,
    actualPath: window.location.pathname,
    actualSearch: window.location.search,
    theme: document.documentElement.dataset.theme,
    storageTheme: window.localStorage.getItem("runflow_theme"),
    bodyText: document.body.innerText.trim().replace(/\s+/g, " ").slice(0, 280),
    bodyTextLength: document.body.innerText.trim().length,
    loading: document.body.innerText.includes("Carregando..."),
    rawTranslationKey: /\b(?:nav|footer)\.[a-z_]+/i.test(document.body.innerText),
    mainPresent: Boolean(document.querySelector("main")),
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  }), route);
}

const browser = await chromium.connectOverCDP(cdpUrl);
const pages = browser.contexts().flatMap((context) => context.pages());
if (pages.length === 0) throw new Error(`Nenhuma página WebView encontrada em ${cdpUrl}`);

const page = pages[0];
const badResponses = [];
const consoleErrors = [];
page.on("response", (response) => {
  if (response.status() >= 400 && !/favicon/i.test(response.url())) {
    badResponses.push({ status: response.status(), url: response.url() });
  }
});
page.on("requestfailed", (request) => {
  const failure = request.failure()?.errorText ?? "";
  if (!/ERR_ABORTED|favicon/i.test(`${failure} ${request.url()}`)) {
    badResponses.push({ status: "failed", url: request.url(), error: failure });
  }
});
page.on("console", (message) => {
  if (message.type() === "error" && !/favicon/i.test(message.text())) consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));

await page.goto("https://localhost/", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(1000);
const lightToggle = page.locator('button[aria-label="Ativar modo claro"]');
if (await lightToggle.count()) {
  await lightToggle.click();
  await page.waitForTimeout(500);
}

const results = [];
for (const route of routes) {
  await page.goto(`https://localhost${route.path}${route.search}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(waitAfterNavigationMs);
  results.push(await snapshot(page, route));
}

const invalid = results.filter((result) => (
  result.actualPath !== result.expectedPath ||
  result.actualSearch !== result.expectedSearch ||
  result.theme !== "light" ||
  result.storageTheme !== "light" ||
  result.loading ||
  result.rawTranslationKey ||
  !result.mainPresent ||
  result.horizontalOverflow ||
  result.bodyTextLength < 50
));
const status = invalid.length || badResponses.length || consoleErrors.length ? "FAIL" : "PASS";
console.log(JSON.stringify({ status, cdpUrl, results, badResponses, consoleErrors }, null, 2));
await browser.close();
if (status !== "PASS") process.exitCode = 1;
