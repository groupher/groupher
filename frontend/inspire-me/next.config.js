const withBaseConfig = require('@groupher/frontend-core/next.config')

module.exports = withBaseConfig({
  cacheComponents: false,
  experimental: {
    scrollRestoration: true,
    optimizePackageImports: ['ramda'],
  },
})
