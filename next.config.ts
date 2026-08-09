import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mammoth and unpdf are Node-only; keep them out of the bundler's reach.
  serverExternalPackages: ["mammoth", "unpdf"],
};

export default nextConfig;
