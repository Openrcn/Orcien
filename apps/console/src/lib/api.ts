const DEFAULT_GATEWAY_ORIGIN = "http://localhost:27100";

/**
 * Resolves the HTTP origin of the Go gateway.
 *
 * Priority: explicit env → the current origin when it already points at the
 * gateway → the local gateway default during web development → current origin
 * (production, where console and gateway share a host).
 */
export function apiOrigin(): string {
  const env = process.env.NEXT_PUBLIC_API_URL;
  if (env) return env.replace(/\/$/, "");

  if (typeof window === "undefined") return DEFAULT_GATEWAY_ORIGIN;

  const { hostname, port, protocol } = window.location;
  if (port === "27100") return `${protocol}//${hostname}:${port}`;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return DEFAULT_GATEWAY_ORIGIN;
  }
  return `${protocol}//${window.location.host}`;
}

import { getOrgSnapshot } from "./org-store";

/** Builds a WebSocket URL for a gateway path (e.g. "/api/v1/..."). */
export function wsUrl(path: string): string {
  const origin = apiOrigin().replace(/^http/, "ws");
  return `${origin}${path}`;
}

/**
 * Drop-in fetch that scopes the request to the organization in the current
 * URL by attaching `X-Organization-ID` (the gateway's default org fallback
 * applies when the org has not been resolved yet).
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const org = getOrgSnapshot();
  const headers = new Headers(init?.headers);
  if (org.org?.ID) headers.set("X-Organization-ID", org.org.ID);
  return fetch(path, { ...init, headers });
}
