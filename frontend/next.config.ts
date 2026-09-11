import type { NextConfig } from "next";

const BACKEND_TARGET = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/v1/:path*',
        destination: `${BACKEND_TARGET}/v1/:path*`,
      },
      {
        source: '/api/console/:path*',
        destination: `${BACKEND_TARGET}/api/console/:path*`,
      },
    ];
  },
};

export default nextConfig;

