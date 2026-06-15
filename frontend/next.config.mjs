/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['reactflow', '@reactflow/core', '@reactflow/background', '@reactflow/controls', '@reactflow/minimap'],
  images: {
    domains: ['localhost'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      // Holidays moved into the Foundation module; keep old bookmarks working.
      {
        source: '/dashboard/holidays/:path*',
        destination: '/foundation/holidays/:path*',
        permanent: false,
      },
      {
        source: '/dashboard/holidays',
        destination: '/foundation/holidays',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
