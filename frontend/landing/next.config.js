// next.config.js
const withBaseConfig = require('../config/next.config')

module.exports = withBaseConfig({
  output: 'export',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/landing' : '',
})
