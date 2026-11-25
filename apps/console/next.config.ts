import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const gatewayOrigin = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:27100"
).replace(/\/$/, "");

/** Read a value from the repo-root .env (the same file the Go services load). */
function rootEnv(key: string, fallback: string): string {
  if (process.env[key]) return process.env[key] as string;
  for (const relative of ["../../.env", "../.env", ".env"]) {
    try {
      const contents = readFileSync(resolve(process.cwd(), relative), "utf8");
      const match = contents.match(new RegExp(`^${key}=(.*)$`, "m"));
      if (match) {
        return match[1].trim().replace(/^["']|["']$/g, "");
      }
    } catch {
      // try the next candidate path
    }
  }
  return fallback;
}

const appDomain = rootEnv("APP_DOMAIN", "orcn.dev");
const ingressPort = rootEnv("INGRESS_PORT", "27101");

const nextConfig: NextConfig = {
  // Public route previews use the same domain/port as the ingress service.
  env: {
    NEXT_PUBLIC_APP_DOMAIN: appDomain,
    NEXT_PUBLIC_INGRESS_PORT: ingressPort,
  },
  allowedDevOrigins: ["127.0.0.1"],
  async redirects() {
    // Config-level redirects avoid calling redirect() during React render,
    // which triggers a Turbopack/React Performance.measure negative-timestamp
    // error in next dev (vercel/next.js#86060).
    return [
      {
        source: "/dashboard",
        destination: "/",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${gatewayOrigin}/api/v1/:path*`, // Proxy to Go Gateway via IPv4
      },
    ];
  },
};

export default nextConfig;
