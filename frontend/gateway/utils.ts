import { startsWith } from 'ramda'
import APP from '~/const/app'

export const STATIC_PATHS = ['/', '/pricing', '/book-demo']

export const SITE = {
  LANDING: process.env.LANDING_SITE || `https://${APP.LANDING}.groupher.com`,
  MAIN: process.env.MAIN_SITE || `https://${APP.MAIN}.groupher.com`,
  DASHBOARD: process.env.DASHBOARD_SITE || `https://${APP.DASHBOARD}.groupher.com`,
}

/**
 * Get the static asset path signature for a given site URL
 * @param url - The full URL of the site
 * @returns The static asset path signature
 */
const getNextStaticSign = (url: string): string => {
  const subdomain = new URL(url).hostname.split('.')[0]
  return `/${subdomain}/_next/static`
}

const LANDING_STATIC_SIGN = getNextStaticSign(SITE.LANDING)
const DASHBOARD_STATIC_SIGN = getNextStaticSign(SITE.DASHBOARD)

/**
 * Check if the given pathname is a landing page static route
 * @param pathname - The pathname to check
 * @returns True if it's a landing page static route, false otherwise
 */
export const isLandingStaticRoute = (pathname: string): boolean => {
  return startsWith(LANDING_STATIC_SIGN, pathname)
}

/**
 * Check if the given pathname is a dashboard static route
 * @param pathname - The pathname to check
 * @returns True if it's a dashboard static route, false otherwise
 */
export const isDashboardStaticRoute = (pathname: string): boolean => {
  return startsWith(DASHBOARD_STATIC_SIGN, pathname)
}

/**
 * Check if the given pathname and host indicate a dashboard route
 * @param pathname - The pathname to check
 * @param host - The host to check
 * @returns True if it's a dashboard route, false otherwise
 *
 * Examples:
 * - isDashboardRoute('/cps/dashboard', 'www.example.com') => true
 * - isDashboardRoute('/cps', 'dashboard.example.com') => true
 * - isDashboardRoute('/cps', 'www.example.com') => false
 * - isDashboardRoute('/organizations/settings/dashboard', 'www.example.com') => false
 */
export const isDashboardRoute = (pathname: string, host: string): boolean => {
  if (host.startsWith(`${APP.DASHBOARD}.`)) {
    return true
  }

  const pathParts = pathname.split('/').filter(Boolean)
  return pathParts.length >= 2 && pathParts[1] === 'dashboard'
}

/**
 * Get the dashboard URL based on the given pathname, host, and search parameters
 * @param pathname - The original pathname
 * @param host - The original host
 * @param search - The search parameters
 * @returns The new URL for the dashboard
 *
 * Examples:
 * - getDashboardUrl('/cps/dashboard', 'www.example.com', '')
 *   => new URL('/cps', 'https://dashboard.groupher.com')
 * - getDashboardUrl('/cps', 'dashboard.example.com', '?page=1')
 *   => new URL('/cps?page=1', 'https://dashboard.groupher.com')
 */
export const getDashboardUrl = (pathname: string, host: string, search: string): URL => {
  if (host.startsWith(`${APP.DASHBOARD}.`)) {
    // If it's already a dashboard subdomain, just rewrite to DASHBOARD_SITE
    return new URL(pathname + search, SITE.DASHBOARD)
  }

  // For /xxx/dashboard format, remove the /dashboard part
  const pathParts = pathname.split('/').filter(Boolean)
  if (pathParts.length >= 2) {
    const dashboardPath = `/${pathParts[0]}`
    return new URL(dashboardPath + search, SITE.DASHBOARD)
  }

  // If parsing fails or the path structure is unexpected,
  // return the dashboard home page as a fallback
  return new URL('/', SITE.DASHBOARD)
}
