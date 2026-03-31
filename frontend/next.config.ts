import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: false, // Disable to prevent double WebSocket connections in dev
  outputFileTracingRoot: path.join(__dirname),
  async rewrites() {
    return [
      {
        source: '/beta',
        destination: '/beta/index.html',
      },
    ];
  },
  eslint: {
    // Disable ESLint during builds - we'll run it separately
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'developers.google.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '4000',
      },
      {
        protocol: 'https',
        hostname: 'withly.co.il',
      },
      {
        protocol: 'https',
        hostname: 'www.withly.co.il',
      },
      {
        protocol: 'http',
        hostname: 'withly.co.il',
      },
      {
        protocol: 'http',
        hostname: 'www.withly.co.il',
      },
    ],
  },
};

export default nextConfig;
