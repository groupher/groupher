// base-next.config.js

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const baseConfig = {
  reactStrictMode: true,
  swcMinify: true,
  productionBrowserSourceMaps: false,
  experimental: {
    scrollRestoration: true,
    optimizePackageImports: ['ramda'],
    missingSuspenseWithCSRBailout: false,
  },

  async headers() {
    return [
      {
        source: '/oops',
        headers: [
          {
            key: 'cache-control',
            value: 's-maxage=6000, stale-while-revalidate=30',
          },
        ],
      },
    ]
  },
}

module.exports = (customConfig = {}) => {
  const mergedConfig = {
    ...baseConfig,
    ...customConfig,
    experimental: {
      ...baseConfig.experimental,
      ...customConfig.experimental,
    },
  }

  return withBundleAnalyzer(mergedConfig)
}
