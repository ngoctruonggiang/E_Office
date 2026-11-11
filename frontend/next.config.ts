import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle at .next/standalone for a slim
  // production Docker image (see Dockerfile). server.js honours PORT/HOSTNAME.
  output: "standalone",
};

export default nextConfig;
