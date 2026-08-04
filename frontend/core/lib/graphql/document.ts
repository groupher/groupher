const normalizeGQLQuery = (query: string): string => {
  let normalized = query.replace(/#.*?(\n|$)/g, '')
  normalized = normalized.replace(/"""[\s\S]*?"""/g, '')
  normalized = normalized.replace(/\s+/g, ' ').trim()
  normalized = normalized.replace(/^(query|mutation|subscription)(?=[^\s])/, '$1 ')

  return normalized
}

/**
 * Extracts a GraphQL operation name, or the first selected root field for
 * anonymous documents.
 *
 * SSR response helpers use this to unwrap `{ data: { operationName: ... } }`
 * without duplicating operation names beside every query string.
 *
 * @example
 * ```ts
 * extractQueryName('query CurrentUser { me { login } }')
 * // => 'CurrentUser'
 *
 * extractQueryName('{ community(slug: "home") { title } }')
 * // => 'community'
 * ```
 */
export const extractQueryName = (schema: string): string | null => {
  const normalized = normalizeGQLQuery(schema)

  const namedQueryRegex = /^(query|mutation|subscription)\s+(\w+)\s*(?:\(|\{)/
  const namedMatch = normalized.match(namedQueryRegex)
  if (namedMatch) return namedMatch[2]

  const anonymousRegex = /^(query|mutation|subscription)?\s*(?:\([^)]*\))?\s*\{\s*(\w+)/
  const anonymousMatch = normalized.match(anonymousRegex)
  if (anonymousMatch) return anonymousMatch[2]

  return null
}
