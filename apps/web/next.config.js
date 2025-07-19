/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@finito/types',
    '@finito/storage',
    '@finito/provider-client',
    '@finito/crypto',
    '@finito/ui',
    '@finito/core',
  ],
  // Note: serverExternalPackages not supported in Next.js 14.2.30
  // Server Actions handle the server-side separation instead
  experimental: {
    // Enable for better monorepo support
    externalDir: true,
  },
  // Production optimizations
  poweredByHeader: false,
  compress: true,
  // Enable standalone output for Docker if needed
  // output: 'standalone',
  // Removed API rewrites for single-app deployment
  // async rewrites() {
  //   return [
  //     {
  //       source: '/api/:path*',
  //       destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
  //     },
  //   ]
  // },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig