import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "your-cloudflare-domain.com",
      },
    ],
  },
};

export default nextConfig;
