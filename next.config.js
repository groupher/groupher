module.exports = {
  experimental: {
    // this will allow nextjs to resolve files (js, ts, css)
    // outside packages/app directory.
    externalDir: true,
    zones: [
      { name: 'landing', path: './packages/frontend/landing' },
      { name: 'main', path: './packages/frontend/main' },
    ],
  },
  rewrites: async () => {
    return [
      {
        source: '/',
        destination: '/landing',
      },
      {
        source: '/:path*',
        destination: '/main/:path*',
      },
    ]
  },
}
