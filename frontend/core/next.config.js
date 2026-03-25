// base-next.config.js
const path = require('node:path')
const { compilerOptions } = require('./tsconfig.json')

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

const tsconfigAlias = Object.entries(compilerOptions.paths || {}).reduce((acc, [key, values]) => {
  const [firstValue] = values

  if (!firstValue) {
    return acc
  }

  acc[key.replace(/\/\*$/, '')] = path.resolve(__dirname, firstValue.replace(/\/\*$/, ''))

  return acc
}, {})

/** @type {import('next').NextConfig} */
const baseConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  cacheComponents: true,
  experimental: {
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
    webpack(config, options) {
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        ...tsconfigAlias,
      }

      if (typeof customConfig.webpack === 'function') {
        return customConfig.webpack(config, options)
      }

      return config
    },
    experimental: {
      ...baseConfig.experimental,
      ...customConfig.experimental,
    },
  }

  return withBundleAnalyzer(mergedConfig)
}
