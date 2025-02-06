// next.config.js
const withBaseConfig = require('../config/next.config')

module.exports = withBaseConfig({
  output: 'export',
  assetPrefix: '/landing',
})
