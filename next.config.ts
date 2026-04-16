import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Allow R2 public bucket images
      { protocol: 'https', hostname: '*.r2.dev' },
      { protocol: 'https', hostname: '*.cloudflarestorage.com' },
    ],
  },
};

export default nextConfig;
