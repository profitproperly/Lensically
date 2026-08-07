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
