/** Prevent a local development Auth address from being embedded in a production bundle. */
export function buildAuthEndpoint(
  value: string | undefined,
  production: boolean,
): string | undefined {
  if (!value || !production) return value

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('NEXT_PUBLIC_AUTH_ENDPOINT must be a valid production URL.')
  }
  const host = url.hostname.toLowerCase()
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username !== '' ||
    url.password !== '' ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '[::1]' ||
    host === '0.0.0.0' ||
    host.startsWith('127.')
  ) {
    throw new Error(
      'NEXT_PUBLIC_AUTH_ENDPOINT must use a non-local URL without credentials in production.',
    )
  }
  return value
}
