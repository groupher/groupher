import { ArtimentPublisherError, type TArtimentBodyBag } from '@groupher/artiment-publisher'

import { GRAPHQL_ENDPOINT } from '~/config'

import { dashboardToPhoenixHeaders } from '../serviceIdentity'

export type TUpdateDocDraftVariables = {
  community: string
  id: string
  title?: string
  subtitle?: string
  slug?: string
}

type TGraphQLError = {
  message?: unknown
}

type TGraphQLPayload<T> = {
  data?: T | null
  errors?: TGraphQLError[]
}

type TOptions = {
  backendToken: string
  bodyBag: TArtimentBodyBag
  fetchImpl?: typeof fetch
  graphqlEndpoint?: string
  variables: TUpdateDocDraftVariables
}

const UPDATE_DOC_DRAFT = `
  mutation UpdateDocDraft(
    $community: String!
    $id: ID!
    $title: String
    $subtitle: String
    $slug: String
    $bodyBag: ArtimentBodyBagInput!
  ) {
    updateDocDraft(
      community: $community
      id: $id
      title: $title
      subtitle: $subtitle
      slug: $slug
      bodyBag: $bodyBag
    ) {
      id
      docId
      title
      subtitle
      slug
      digest
      stage
      insertedAt
      updatedAt
      author {
        login
        nickname
        avatar
      }
      document {
        json
        markdown
        markdownToc
        html
        plainText
        digest
        bodyHash
        schemaVersion
      }
    }
  }
`

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

/** Sends one trusted BodyBag while preserving the caller's user authorization separately. */
export const updateDocDraftWithBodyBag = async <TData>({
  backendToken,
  bodyBag,
  fetchImpl = fetch,
  graphqlEndpoint = GRAPHQL_ENDPOINT,
  variables,
}: TOptions): Promise<TData> => {
  const response = await fetchImpl(graphqlEndpoint, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(await dashboardToPhoenixHeaders(backendToken, 'dashboard:body-bag:write')),
    },
    body: JSON.stringify({
      query: UPDATE_DOC_DRAFT,
      variables: { ...variables, bodyBag },
    }),
  })

  if (!response.ok) {
    throw new ArtimentPublisherError(
      'backend_request_failed',
      `Groupher GraphQL returned HTTP ${response.status}.`,
      { status: 502 },
    )
  }

  const payload = (await response.json()) as TGraphQLPayload<{ updateDocDraft?: TData | null }>
  const graphqlError = payload.errors
    ?.map((error) => formatGraphQLErrorMessage(error.message))
    .find((message): message is string => !!message)

  if (graphqlError) {
    throw new ArtimentPublisherError('graphql_error', graphqlError, { status: 422 })
  }

  const draft = payload.data?.updateDocDraft
  if (!draft) {
    throw new ArtimentPublisherError(
      'backend_request_failed',
      'Groupher GraphQL returned no updated draft.',
      { status: 502 },
    )
  }

  return draft
}
