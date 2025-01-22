// const webpack = require('webpack')

// next-plugins
// const withPlugins = require('next-compose-plugins')

// const withPWA = require('next-pwa')({
//   dest: 'public',
// })

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

// next-plugins end

// if move pwa config to witPlugins, it will not work
/** @type {import('next').NextConfig} */
const nextConfig = {
  // transpilePackages: ['ramda'],
  // only in dev
  // see https://nextjs.org/docs/pages/building-your-application/rendering
  //     https://github.com/vercel/next.js/issues/35822
  reactStrictMode: true,
  swcMinify: true,
  productionBrowserSourceMaps: false,
  experimental: {
    reactCompiler: true,
    scrollRestoration: true,
    optimizePackageImports: ['ramda'],
    // for fix build error for useSearchParams
    missingSuspenseWithCSRBailout: false,
  },

  async headers() {
    return [
      {
        source: '/',
        headers: [
          {
            key: 'cache-control',
            value: 's-maxage=600, stale-while-revalidate=30',
          },
        ],
      },
      {
        source: '/pricing',
        headers: [
          {
            key: 'cache-control',
            value: 's-maxage=600, stale-while-revalidate=30',
          },
        ],
      },
      {
        source: '/book-demo',
        headers: [
          {
            key: 'cache-control',
            value: 's-maxage=600, stale-while-revalidate=30',
          },
        ],
      },
      {
        source: '/oops',
        headers: [
          {
            key: 'cache-control',
            value: 's-maxage=6000, stale-while-revalidate=30',
          },
        ],
      },
    ]
  },
}

// module.exports = withBundleAnalyzer(withPWA(nextConfig))
module.exports = withBundleAnalyzer(nextConfig)
