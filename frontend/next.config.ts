import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "your-cloudflare-domain.com",
      },
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
    ],
  },
  // turbopack: {
  //   resolveAlias: {
  //     accounts: "./lib/empty-module.ts",
  //   },
  // },
};

export default nextConfig;
