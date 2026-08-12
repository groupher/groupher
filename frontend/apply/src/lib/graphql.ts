type GraphQLResponse<T> = {
  data?: T
  errors?: Array<{ extensions?: { code?: unknown; reasonCode?: unknown }; message?: string }>
}

export class ClientGraphQLError extends Error {
  reasonCode?: string

  constructor(message: string, reasonCode?: string) {
    super(message)
    this.name = 'ClientGraphQLError'
    this.reasonCode = reasonCode
  }
}

export const clientGraphQL = async <T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> => {
  const response = await fetch('/apply/api/graphql', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const responseText = await response.text()
  let payload: GraphQLResponse<T>
  try {
    payload = JSON.parse(responseText) as GraphQLResponse<T>
  } catch {
    throw new ClientGraphQLError(`Request failed with HTTP ${response.status}.`)
  }
  if (!response.ok || payload.errors?.length) {
    const error = payload.errors?.[0]
    const rawCode = error?.extensions?.reasonCode ?? error?.extensions?.code
    throw new ClientGraphQLError(
      error?.message || `Request failed with HTTP ${response.status}.`,
      typeof rawCode === 'string' ? rawCode : undefined,
    )
  }
  if (!payload.data) throw new ClientGraphQLError('Response did not include data.')
  return payload.data
}
