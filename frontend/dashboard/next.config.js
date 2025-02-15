// next.config.js
const withBaseConfig = require('../config/next.config')

module.exports = withBaseConfig({
  assetPrefix: process.env.NODE_ENV === 'production' ? '/dashboard' : '',
})
