/**
 * Implements the Redirect Url boundary inside Auth.
 *
 * Business position:
 *
 *   Browser / Gateway
 *     -> Auth module
 *     -> OAuth provider / Phoenix Accounts
 *     -> Session cookies or service token
 */

type TResolveAuthRedirectOptions = {
  baseUrl: string
  sharedDomain?: string
  url: string
}

const normalizeDomain = (domain: string): string => domain.trim().replace(/^\./, '')

const isDomainOrSubdomain = (hostname: string, domain: string): boolean => {
  return hostname === domain || hostname.endsWith(`.${domain}`)
}

/** Resolves auth redirect without leaking auth routing details to callers. */
export const resolveAuthRedirect = ({
  baseUrl,
  sharedDomain,
  url,
}: TResolveAuthRedirectOptions): string => {
  try {
    const base = new URL(baseUrl)
    const redirect = new URL(url, base)
    const trustedDomain = normalizeDomain(sharedDomain || base.hostname)

    const isTrusted =
      redirect.protocol === base.protocol &&
      redirect.port === base.port &&
      !redirect.username &&
      !redirect.password &&
      isDomainOrSubdomain(redirect.hostname, trustedDomain)

    return isTrusted ? redirect.toString() : baseUrl
  } catch {
    return baseUrl
  }
}
