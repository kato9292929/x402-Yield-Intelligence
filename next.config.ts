import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["x402-next"],
  webpack: (config) => {
    // pino-pretty is an optional pino dependency pulled in transitively by
    // WalletConnect logging; it is never used here. Mark it external to
    // silence the "Can't resolve 'pino-pretty'" build warning.
    config.externals.push("pino-pretty");
    return config;
  },
};

export default nextConfig;
