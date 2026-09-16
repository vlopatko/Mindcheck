import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "steam-user",
    "globaloffensive",
    "cs2parser",
    "unbzip2-stream",
  ],
};

export default nextConfig;
