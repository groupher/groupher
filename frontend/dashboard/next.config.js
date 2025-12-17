// next.config.js
const withBaseConfig = require('@groupher/frontend-core/next.config')

module.exports = withBaseConfig({
  assetPrefix: process.env.NODE_ENV === 'production' ? '/dashboard' : '',

  async rewrites() {
    return [
      {
        // 对应原 /dashboard/_next/static/(.*)
        source: '/dashboard/_next/static/:path*',
        destination: '/_next/static/:path*',
      },
      {
        // 对应原 /dashboard/(.*)
        // 注意：Next.js 的 rewrite 会自动排除已存在的 api 或 静态文件路径
        source: '/dashboard/:path*',
        destination: '/:path*',
      },
    ]
  },
})
