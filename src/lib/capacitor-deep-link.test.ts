import { describe, expect, it } from "vitest";
import {
  getCapacitorDeepLinkEntryPath,
  getCapacitorDeepLinkEntryUrl,
} from "./capacitor-deep-link";

describe("Capacitor deep-link entry paths", () => {
  it("maps a supported trailing-slash route to its static entry file", () => {
    expect(getCapacitorDeepLinkEntryPath("/gravar/")).toBe("/gravar/index.html");
    expect(getCapacitorDeepLinkEntryPath("/atividades/")).toBe("/atividades/index.html");
    expect(getCapacitorDeepLinkEntryPath("/rotas/criar/")).toBe("/rotas/criar/index.html");
  });

  it("does not redirect the home or an already explicit entry file", () => {
    expect(getCapacitorDeepLinkEntryPath("/")).toBeNull();
    expect(getCapacitorDeepLinkEntryPath("/gravar/index.html")).toBeNull();
  });

  it("does not redirect unsupported paths", () => {
    expect(getCapacitorDeepLinkEntryPath("/not-found/")).toBeNull();
    expect(getCapacitorDeepLinkEntryPath("/api/health/")).toBeNull();
  });

  it("preserves query strings and hash fragments for deep links", () => {
    expect(getCapacitorDeepLinkEntryUrl("/atividades/ver/", "?id=activity-1", "#mapa")).toBe(
      "/atividades/ver/index.html?id=activity-1#mapa",
    );
  });
});
