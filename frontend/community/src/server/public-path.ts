const PLATFORM_HOSTS = new Set([
  'groupher.com',
  'www.groupher.com',
  'groupher.localhost',
  'www.groupher.localhost',
  'localhost',
  '127.0.0.1',
])

const normalizeSuffix = (suffix: string): string => {
  if (!suffix || suffix === '/') return ''
  return suffix.startsWith('/') ? suffix : `/${suffix}`
}

/** Accepts proxy community context only when the rewritten path carries the same slug. */
export const isCommunityPathContextTrusted = (pathname: string, slug: string): boolean =>
  Boolean(slug) && pathname.split('/')[1] === slug

/** Returns a browser-visible community path, removing the internal slug on custom domains. */
export const communityPublicPath = (
  community: string,
  suffix = '',
  customDomainOrMatches: boolean | readonly unknown[] = false,
): string => {
  const normalizedSuffix = normalizeSuffix(suffix)
  const customDomain =
    typeof customDomainOrMatches === 'boolean'
      ? customDomainOrMatches
      : customDomainOrMatches.some(
          (match) =>
            (match as { loaderData?: { requestContext?: { customDomain?: boolean } } }).loaderData
              ?.requestContext?.customDomain === true,
        )
  const browserCustomDomain =
    typeof window !== 'undefined' && !PLATFORM_HOSTS.has(window.location.hostname.toLowerCase())

  return customDomain || browserCustomDomain
    ? normalizedSuffix || '/'
    : `/${community}${normalizedSuffix}`
}
