/**
 * Implements the Src Lib GroupherGraphql boundary inside Content Import.
 *
 * Business position:
 *
 *   Dash proxy / Phoenix import job
 *     -> Content Import module
 *     -> canonical source tree / apply batch
 *     -> Phoenix persistence boundary
 */

import { GROUPHER_USER_AUTHORIZATION_HEADER } from '@groupher/contracts/headers'
import { createServiceAuthClientFromEnv, type TServiceAuthClient } from '@groupher/service/auth'

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
  serviceSubject?: string
  serviceScope?: string
}

/** Resolves delegation subject without leaking content import routing details to callers. */
export const resolveDelegationSubject = async (backendToken: string): Promise<string | null> => {
  const data = await requestGroupherGraphQL<{
    sessionState?: { delegationSubject?: string | null; isValid?: boolean | null } | null
  }>(
    `query ResolveDelegationSubject {
      sessionState {
        delegationSubject
        isValid
      }
    }`,
    {},
    {
      backendToken,
      serviceSubject: 'service:content-import',
      serviceScope: 'content-import:write',
    },
  )

  const subject = data.sessionState?.delegationSubject
  return data.sessionState?.isValid && typeof subject === 'string' && subject.startsWith('user:')
    ? subject
    : null
}

let serviceTokenProvider: TServiceAuthClient | undefined

const configuredGraphQLEndpoint = (): string => {
  const endpoint = process.env.PHOENIX_GRAPHQL_ENDPOINT?.trim()
  if (!endpoint) throw new Error('PHOENIX_GRAPHQL_ENDPOINT is not configured.')
  return endpoint
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

/** Runs the request groupher graph ql operation at the content import boundary. */
export const requestGroupherGraphQL = async <T>(
  query: string,
  variables: Record<string, unknown>,
  options: TGroupherGraphQLOptions,
): Promise<T> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.backendToken && options.serviceSubject) {
    serviceTokenProvider ??= createServiceAuthClientFromEnv()
    const token = await serviceTokenProvider.getToken({
      resource: 'https://api.groupher.com/content-import',
      scopes: [options.serviceScope || 'content-import:write'],
    })
    headers.Authorization = `Bearer ${token}`
    headers[GROUPHER_USER_AUTHORIZATION_HEADER] = `Bearer ${options.backendToken}`
  }
  const response = await (options.fetchImpl ?? fetch)(
    options.graphqlEndpoint ?? configuredGraphQLEndpoint(),
    {
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
      headers,
      method: 'POST',
    },
  )
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
