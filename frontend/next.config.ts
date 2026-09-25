import type { NextConfig } from "next";

const backendPort = process.env.BACKEND_PORT || "8000";
const backendUrl = process.env.BACKEND_URL || `http://127.0.0.1:${backendPort}`;

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

