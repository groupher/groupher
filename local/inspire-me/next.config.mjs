/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  cacheComponents: false,
  experimental: {
    scrollRestoration: true,
    useTypeScriptCli: true,
    reactDebugChannel: false,
    turbopackFileSystemCacheForDev: true,
    turbopackFileSystemCacheForBuild: true,
  },
  logging: {
    browserToTerminal: true,
  },
}

export default nextConfig
