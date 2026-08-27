import { describe, expect, it } from "vitest";
import { rewriteCssAssetPaths, rewriteHtmlAssetPaths } from "./patch-file-export.mjs";

const html = '<link href="/_next/static/css/app.css"><script src="/_next/static/chunks/app.js"></script>';
const css = '.icon { background: url("/_next/static/media/icon.svg"); }';

describe("static export asset paths", () => {
  it("keeps file:// assets relative for a nested route", () => {
    const rewritten = rewriteHtmlAssetPaths(html, { target: "file", prefix: "../" });

    expect(rewritten).toContain('href="../_next/static/css/app.css"');
    expect(rewritten).toContain('src="../_next/static/chunks/app.js"');
  });

  it("keeps Capacitor assets rooted at the WebView origin", () => {
    const rewritten = rewriteHtmlAssetPaths(html, { target: "capacitor", prefix: "../" });

    expect(rewritten).toContain('href="/_next/static/css/app.css"');
    expect(rewritten).toContain('src="/_next/static/chunks/app.js"');
    expect(rewritten).not.toContain("../_next/");
  });

  it("applies the same target rule to CSS URLs", () => {
    expect(rewriteCssAssetPaths(css, { target: "file", prefix: "../" })).toContain(
      'url("../_next/static/media/icon.svg")',
    );
    expect(rewriteCssAssetPaths(css, { target: "capacitor", prefix: "../" })).toContain(
      'url("/_next/static/media/icon.svg")',
    );
  });
});
