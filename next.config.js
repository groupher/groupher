module.exports = {
  experimental: {
    zones: [
      { name: 'landing', path: './packages/frontend/landing' },
      { name: 'main', path: './packages/frontend/main' },
    ],
  },
  rewrites: async () => {
    return [
      {
        source: '/:path*',
        destination: '/main/:path*',
      },
    ]
  },
}
