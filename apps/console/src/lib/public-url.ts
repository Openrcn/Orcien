/**
 * Frontend mirror of pkg/routing (route key) + the ingress listener settings.
 * Used everywhere a public deployment/workload URL is previewed so the console
 * never hardcodes a domain or port.
 */

/** Mirrors routing.SlugLabel in pkg/routing/route_key.go. */
export function slugLabel(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Mirrors routing.DeploymentRouteKey: "<deployment>.<org>". */
export function deploymentRouteKey(name: string, orgSlug: string): string {
  const deployment = slugLabel(name);
  const organization = slugLabel(orgSlug);
  return organization ? `${deployment}.${organization}` : deployment;
}

/** APP_DOMAIN from the repo-root .env (injected in next.config.ts). */
export function appDomain(): string {
  return (process.env.NEXT_PUBLIC_APP_DOMAIN || "orcn.dev").trim();
}

/** INGRESS_PORT from the repo-root .env (injected in next.config.ts). */
export function ingressPort(): string {
  return (process.env.NEXT_PUBLIC_INGRESS_PORT || "27101").trim();
}

/** Build the host for a public route, e.g. deploy-ja27.default.orcn.dev:27101. */
export function routeHost(subdomain: string): string {
  const port = ingressPort();
  const domain = appDomain();
  const authority = port && port !== "80" && port !== "443" ? `${domain}:${port}` : domain;
  return `${subdomain}.${authority}`;
}

/** Build the full URL for a public route (plain HTTP on the dev ingress port). */
export function routeUrl(subdomain: string): string {
  const scheme = ingressPort() === "443" ? "https" : "http";
  return `${scheme}://${routeHost(subdomain)}`;
}

/** Public URL of a deployment, following the backend route-key rules. */
export function deploymentUrl(name: string, orgSlug: string): string {
  return routeUrl(deploymentRouteKey(name, orgSlug));
}
