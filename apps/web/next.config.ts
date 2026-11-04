import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.prismic.io" },
      { protocol: "https", hostname: "dicewebsite.cdn.prismic.io" },
      { protocol: "https", hostname: "dice.fm" },
    ],
  },
  outputFileTracingIncludes: {
    "/api/maplibre-worker": [
      "./node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs",
    ],
  },
};

export default nextConfig;
