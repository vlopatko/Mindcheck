import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@laihoe/demoparser2",
    "steam-user",
    "globaloffensive",
    "cs2parser",
    "unbzip2-stream",
  ],
  experimental: {
    proxyClientMaxBodySize: "1100mb",
  },
};

export default nextConfig;
