import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const configDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(configDir);

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: workspaceRoot,
  },
    async headers() {
    const noStoreHeaders = [
      { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" },
      { key: "CDN-Cache-Control", value: "no-store" },
      { key: "Cloudflare-CDN-Cache-Control", value: "no-store" },
    ];
    return [
      { source: "/operator", headers: noStoreHeaders },
      { source: "/operator/:path*", headers: noStoreHeaders },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/operator",
        destination: "https://lensically-operator.pages.dev/operator/",
      },
      {
        source: "/operator/:path*",
        destination: "https://lensically-operator.pages.dev/operator/:path*",
      },
    ];
  },
};

export default nextConfig;
