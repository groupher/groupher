const { withZone } = require('@vercel/next')

module.exports = withZone({
  zones: [
    {
      name: 'landing',
      path: 'packages/frontend/landing',
    },
    {
      name: 'main',
      path: 'packages/frontend/main',
    },
  ],
})
