// next.config.js
const withBaseConfig = require('../config/next.config')

module.exports = withBaseConfig({
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'x-groupher-part',
            value: 'landing',
          },
        ],
      },
    ]
  },
})
