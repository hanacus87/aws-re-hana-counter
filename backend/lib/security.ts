export function buildContentSecurityPolicy(isDev: boolean): string {
  const base =
    "default-src 'self'; object-src 'none'; frame-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";
  if (!isDev) {
    return base;
  }
  return `${base}; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; img-src 'self' data:`;
}

export function isSameOrigin(
  publicOrigin: string,
  secFetchSite: string | undefined,
  origin: string | undefined,
): boolean {
  return secFetchSite === "same-origin" || origin === publicOrigin;
}
