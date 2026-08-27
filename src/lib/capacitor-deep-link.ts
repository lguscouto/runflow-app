const CAPACITOR_STATIC_ROUTES = new Set([
  "/gravar/",
  "/atividades/",
  "/atividades/ver/",
  "/importar/",
  "/heatmap/",
  "/perfil/",
  "/rotas/",
  "/rotas/criar/",
]);

export function getCapacitorDeepLinkEntryPath(pathname: string): string | null {
  if (!CAPACITOR_STATIC_ROUTES.has(pathname)) return null;
  return `${pathname}index.html`;
}

export function getCapacitorDeepLinkEntryUrl(
  pathname: string,
  search = "",
  hash = "",
): string | null {
  const entryPath = getCapacitorDeepLinkEntryPath(pathname);
  return entryPath ? `${entryPath}${search}${hash}` : null;
}
