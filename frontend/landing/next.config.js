// next.config.js
const withBaseConfig = require('../config/next.config')

module.exports = withBaseConfig({
  // use dynamic IO & cache, so export disable for now
  // or use output but find a way to not use cache staff
  output: 'export',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/landing' : '',
  experimental: {
    cacheComponents: false, // fur use cache
    scrollRestoration: true,
    optimizePackageImports: ['ramda'],
  },
})
