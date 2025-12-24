// next.config.js
const withBaseConfig = require('@groupher/frontend-core/next.config')

module.exports = withBaseConfig({
  assetPrefix: process.env.NODE_ENV === 'production' ? '/dashboard' : '',
})
