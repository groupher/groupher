// next.config.js
const withBaseConfig = require('../config/next.config')

module.exports = withBaseConfig({
  async rewrites() {
    return [
      {
        source: '/',
        destination: '/landing',
      },
      {
        source: '/pricing',
        destination: '/landing',
      },
    ]
  },
})
