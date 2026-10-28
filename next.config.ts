import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/maplibre-worker": [
      "./node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs",
    ],
  },
};

export default nextConfig;
