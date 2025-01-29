/** @type {import('next').NextConfig} */
const nextConfig = {
  generateBuildId: async () => 'build-id',
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        path: false,
        os: false,
      }
    }
    return config
  },
}

module.exports = nextConfig
