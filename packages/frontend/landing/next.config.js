// next.config.js
const withBaseConfig = require('../config/next.config')

module.exports = withBaseConfig({
  assetPrefix: '/landing',
  basePath: '/landing',
})
