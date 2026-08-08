// base-next.config.js

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const baseConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  allowedDevOrigins: [
    '127.0.0.1',
    'groupher.localhost',
    'main.groupher.localhost',
    'dashboard.groupher.localhost',
    'landing.groupher.localhost',
  ],
  cacheComponents: true,
  experimental: {
    useTypeScriptCli: true,
    instantInsights: {
      validationLevel: 'manual-warning',
    },
    reactDebugChannel: false,
    // Enable filesystem caching for `next dev`
    turbopackFileSystemCacheForDev: true,
    // Enable filesystem caching for `next build`
    turbopackFileSystemCacheForBuild: true,
    scrollRestoration: true,
    optimizePackageImports: ['ramda'],
  },
  logging: {
    browserToTerminal: true,
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
