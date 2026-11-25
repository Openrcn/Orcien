import type { NextConfig } from "next";

const gatewayOrigin = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:27100"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
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
