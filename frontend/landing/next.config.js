// next.config.js
const withBaseConfig = require('@groupher/frontend-core/next.config')

module.exports = withBaseConfig({
  // use dynamic IO & cache, so export disable for now
  // or use output but find a way to not use cache staff
  output: 'export',
  allowedDevOrigins: ['groupher.localhost', 'landing.groupher.localhost'],
  assetPrefix: process.env.NODE_ENV === 'production' ? '/landing' : '',
  cacheComponents: false, // no need for landing
  experimental: {
    scrollRestoration: true,
    optimizePackageImports: ['ramda'],
  },
})
