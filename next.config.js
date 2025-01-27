module.exports = {
  rewrites: async () => {
    return [
      { source: '/', destination: '/packages/frontend/landing' },
      { source: '/pricing', destination: '/packages/frontend/landing' },
      { source: '/((?!packages/).*)', destination: '/packages/frontend/main/$1' },
    ]
  },
}
