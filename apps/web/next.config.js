const { withSentryConfig } = require('@sentry/nextjs')

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
  eslint: {
    // WARNING: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
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

// Sentry configuration for source maps and releases
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  // Suppresses source map uploading logs during build
  silent: true,

  // Organization and project from your Sentry account
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for uploading source maps
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only upload source maps in production builds
  dryRun: process.env.NODE_ENV !== 'production',

  // Automatically release tracking
  release: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
}

// Export with Sentry wrapper for automatic instrumentation
module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions, {
  // Hide Sentry comments from source files
  hideSourceMaps: true,

  // Tree shake unused Sentry code
  disableLogger: true,

  // Automatically instrument your app
  autoInstrumentServerFunctions: true,
  autoInstrumentAppDirectory: true,
})
