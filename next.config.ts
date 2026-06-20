import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // COOP + COEP headers enable SharedArrayBuffer so the Zama FHE SDK can use
  // multi-threaded WASM. Without these, encryption runs single-threaded and
  // blocks the main thread for several seconds.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          // 'credentialless' is less strict than 'require-corp' — allows
          // cross-origin resources (Google Fonts, RainbowKit CDN) to load
          // without needing explicit CORP headers.
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true, layers: true };
    return config;
  },
  turbopack: {},
};

export default nextConfig;
