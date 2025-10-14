// next.config.js
const withBaseConfig = require('../core/next.config')

module.exports = withBaseConfig({
  assetPrefix: process.env.NODE_ENV === 'production' ? '/dashboard' : '',
})
