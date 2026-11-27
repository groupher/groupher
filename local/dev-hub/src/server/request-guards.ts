export const buildHubHostAllowlist = (port: number, webPort: number): Set<string> =>
  new Set(
    [port, webPort].flatMap((value) => [
      `127.0.0.1:${value}`,
      `localhost:${value}`,
      `[::1]:${value}`,
    ]),
  )

export const isAllowedHubHost = (
  hostHeader: string | undefined,
  allowedHosts: ReadonlySet<string>,
): boolean => {
  if (!hostHeader) return false
  try {
    const host = new URL(`http://${hostHeader}`).host.toLowerCase()
    return allowedHosts.has(host)
  } catch {
    return false
  }
}

export const isAllowedRequestOrigin = (
  requestOrigin: string | undefined,
  allowedOrigins: ReadonlySet<string>,
): boolean => {
  if (requestOrigin === undefined) return true
  try {
    const parsed = new URL(requestOrigin)
    return parsed.origin === requestOrigin && allowedOrigins.has(parsed.origin)
  } catch {
    return false
  }
}

/** Bind managed mutations to the instance observed by their caller. */
export const isAllowedInstanceMutation = (
  method: string,
  expected: string | undefined,
  supplied: string | undefined,
): boolean => !expected || ['GET', 'HEAD', 'OPTIONS'].includes(method) || supplied === expected
