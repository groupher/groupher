/**
 * Shared fetch options for browser-to-GraphQL requests.
 *
 * Cookies must be included because the web app and API can run on different
 * hosts in production and on different localhost ports during development.
 */
export const FETCH_OPTIONS = (): RequestInit => ({
  // make sure cookie is included
  // since groupher.com and api.groupher.com is different domain
  // same for dev env: localhost:3000 and localhost:4001

  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  },
})

// None of these options have to be added, these are the default values.
/**
 * Network-only retry policy for urql exchanges.
 *
 * GraphQL validation/business errors should be returned to callers unchanged;
 * only transient network failures are retried.
 */
export const RETRY_OPTIONS = {
  initialDelayMs: 1000,
  maxDelayMs: 15000,
  randomDelay: true,
  maxNumberAttempts: 2,
  retryIf: (err) => err?.networkError,
}

const normalizeGQLQuery = (query: string): string => {
  let normalized = query.replace(/#.*?(\n|$)/g, '')
  normalized = normalized.replace(/"""[\s\S]*?"""/g, '')
  normalized = normalized.replace(/\s+/g, ' ').trim()
  normalized = normalized.replace(/^(query|mutation|subscription)(?=[^\s])/, '$1 ')

  return normalized
}

/**
 * Extracts an operation name or first field name from a GraphQL document string.
 *
 * This powers logging/telemetry for both named operations and anonymous queries
 * generated from colocated schema snippets.
 */
export const extractQueryName = (schema: string): string | null => {
  const normalized = normalizeGQLQuery(schema)

  const namedQueryRegex = /^(query|mutation|subscription)\s+(\w+)\s*(?:\(|\{)/
  const namedMatch = normalized.match(namedQueryRegex)
  if (namedMatch) return namedMatch[2]

  const anonymousRegex = /^(query|mutation|subscription)\s*(?:\([^)]*\))?\s*\{\s*(\w+)/
  const anonymousMatch = normalized.match(anonymousRegex)
  if (anonymousMatch) return anonymousMatch[2]

  return null
}
