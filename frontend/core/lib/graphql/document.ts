import { parse, type DocumentNode } from 'graphql'

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
 * This legacy helper returns the operation definition name. SSR response
 * unwrapping must use extractRootResponseKey instead, because GraphQL payloads
 * are keyed by the root field or alias.
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
export const extractQueryName = (schema: string | DocumentNode): string | null => {
  if (typeof schema !== 'string') {
    const operation = schema.definitions.find(
      (definition) => definition.kind === 'OperationDefinition',
    )
    if (!operation || operation.kind !== 'OperationDefinition') return null

    if (operation.name?.value) return operation.name.value

    const field = operation.selectionSet.selections.find((selection) => selection.kind === 'Field')
    return field && field.kind === 'Field' ? (field.alias?.value ?? field.name.value) : null
  }

  const normalized = normalizeGQLQuery(schema)

  const namedQueryRegex = /^(query|mutation|subscription)\s+(\w+)\s*(?:\(|\{)/
  const namedMatch = normalized.match(namedQueryRegex)
  if (namedMatch) return namedMatch[2]

  const anonymousRegex = /^(query|mutation|subscription)?\s*(?:\([^)]*\))?\s*\{\s*(\w+)/
  const anonymousMatch = normalized.match(anonymousRegex)
  if (anonymousMatch) return anonymousMatch[2]

  return null
}

/**
 * Extracts the response key of the first root field in an executable document.
 * GraphQL responses use `alias ?? fieldName`, not the operation definition name.
 */
export const extractRootResponseKey = (schema: string | DocumentNode): string | null => {
  const document = typeof schema === 'string' ? parse(schema) : schema
  const operation = document.definitions.find(
    (definition) => definition.kind === 'OperationDefinition',
  )
  if (!operation || operation.kind !== 'OperationDefinition') return null

  const field = operation.selectionSet.selections.find((selection) => selection.kind === 'Field')
  if (!field || field.kind !== 'Field') return null

  return field.alias?.value ?? field.name.value
}
