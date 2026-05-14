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
