import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from backend server
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/**',
      },
    ],
  },
  // Enable server actions
  experimental: {},
};

export default nextConfig;
