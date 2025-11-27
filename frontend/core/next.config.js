// base-next.config.js

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const baseConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  turbopackFileSystemCaccheForDev: true,
  cacheComponents: true,
  experimental: {
    scrollRestoration: true,
    optimizePackageImports: ['ramda'],
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
