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
  experimental: {
    // Enable for better monorepo support
    externalDir: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig