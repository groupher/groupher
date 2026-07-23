/** @type {import('next').NextConfig} */
module.exports = {
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
