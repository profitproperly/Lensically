import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const configDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(configDir);

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/operator",
          destination: "https://lensically-operator.pages.dev/operator/",
        },
        {
          source: "/operator/:path*",
          destination: "https://lensically-operator.pages.dev/operator/:path*",
        },
      ],
    };
  },
  turbopack: {
    root: workspaceRoot,
  },
};

export default nextConfig;
