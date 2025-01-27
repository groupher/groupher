// next.config.js
const withBaseConfig = require('../config/next.config')

module.exports = withBaseConfig({
  async rewrites() {
    return [
      {
        source: '/:path*',
        destination: '/main/:path*',
      },
    ]
  },
})
