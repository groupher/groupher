import { GRAPHQL_ENDPOINT } from '~/config'
import { GROUPHER_SERVER_TRUST_HEADER } from '~/const/serverTrust'

type TGraphQLError = { code?: unknown; message?: unknown }
type TGraphQLPayload<T> = { data?: T | null; errors?: TGraphQLError[] }

export class GroupherGraphQLError extends Error {
  readonly code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'GroupherGraphQLError'
    this.code = code
  }
}

export type TGroupherGraphQLOptions = {
  backendToken?: string
  fetchImpl?: typeof fetch
  graphqlEndpoint?: string
  serverTrustSecret?: string
}

const formatGraphQLErrorMessage = (value: unknown): string | null => {
  if (typeof value === 'string') return value.trim() || null

  if (Array.isArray(value)) {
    const messages = value.map(formatGraphQLErrorMessage).filter(Boolean)
    return messages.length > 0 ? messages.join('; ') : null
  }

  if (typeof value === 'object' && value !== null) {
    const error = value as Record<string, unknown>
    const message = formatGraphQLErrorMessage(error.message)
    const key = typeof error.key === 'string' ? error.key.trim() : ''
    if (message) return key ? `${key}: ${message}` : message

    try {
      return JSON.stringify(value)
    } catch {
      return null
    }
  }

  return value == null ? null : String(value)
}

export const requestGroupherGraphQL = async <T>(
  query: string,
  variables: Record<string, unknown>,
  options: TGroupherGraphQLOptions,
): Promise<T> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.backendToken) headers.Authorization = `Bearer ${options.backendToken}`
  if (options.serverTrustSecret) {
    headers[GROUPHER_SERVER_TRUST_HEADER] = options.serverTrustSecret
  }
  const response = await (options.fetchImpl ?? fetch)(options.graphqlEndpoint ?? GRAPHQL_ENDPOINT, {
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
    headers,
    method: 'POST',
  })
  if (!response.ok) throw new Error(`Groupher GraphQL returned HTTP ${response.status}.`)
  const payload = (await response.json()) as TGraphQLPayload<T>
  const error = payload.errors
    ?.map((item) => ({
      code: typeof item.code === 'string' ? item.code : undefined,
      message: formatGraphQLErrorMessage(item.message),
    }))
    .find((item) => item.message)
  if (error?.message) throw new GroupherGraphQLError(error.message, error.code)
  if (!payload.data) throw new Error('Groupher GraphQL returned no data.')
  return payload.data
}
