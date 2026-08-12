/**
 * Authenticated single-document publish orchestration.
 *
 * HTTP Plate value -> shared publisher -> BodyBag -> trusted GraphQL mutation
 *
 * Bulk Import calls the publisher directly and never loops through this HTTP route.
 *
 * @see docs/bulk-import/article-publish-import-refactor.md
 */
import {
  ARTIMENT_MAX_INPUT_BYTES,
  ArtimentPublisherError,
  publishArtiment,
  type TArtimentPublisherErrorPayload,
} from '@groupher/artiment-publisher'

import { updateDocDraftWithBodyBag, type TUpdateDocDraftVariables } from './graphql'

type TRequestPayload = {
  action?: unknown
  value?: unknown
  variables?: TUpdateDocDraftVariables
}

type TOptions = {
  backendToken: string
  fetchImpl?: typeof fetch
  graphqlEndpoint?: string
}

const responseHeaders = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
}

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), { headers: responseHeaders, status })

const errorResponse = (error: ArtimentPublisherError): Response => {
  const payload: TArtimentPublisherErrorPayload = {
    code: error.code,
    message: error.message,
    ...(error.diagnostics ? { diagnostics: error.diagnostics } : {}),
  }

  return jsonResponse({ error: payload, ok: false }, error.status)
}

const readUpdateDocDraftVariables = (value: unknown): TUpdateDocDraftVariables => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ArtimentPublisherError('invalid_request', 'Request variables are required.', {
      status: 400,
    })
  }

  const variables = value as Record<string, unknown>
  if (
    typeof variables.community !== 'string' ||
    variables.community.length === 0 ||
    typeof variables.id !== 'string' ||
    variables.id.length === 0
  ) {
    throw new ArtimentPublisherError(
      'invalid_request',
      'Request variables must contain community and id.',
      { status: 400 },
    )
  }

  for (const field of ['slug', 'subtitle', 'title'] as const) {
    if (variables[field] !== undefined && typeof variables[field] !== 'string') {
      throw new ArtimentPublisherError(
        'invalid_request',
        `Request variable ${field} must be a string.`,
        { status: 400 },
      )
    }
  }

  return variables as TUpdateDocDraftVariables
}

const readPayload = async (request: Request): Promise<TRequestPayload> => {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.includes('application/json')) {
    throw new ArtimentPublisherError(
      'unsupported_media_type',
      'Content-Type must be application/json.',
      { status: 415 },
    )
  }

  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > ARTIMENT_MAX_INPUT_BYTES) {
    throw new ArtimentPublisherError('payload_too_large', 'Request body is too large.', {
      status: 413,
    })
  }

  const rawBody = await request.text()
  if (Buffer.byteLength(rawBody, 'utf8') > ARTIMENT_MAX_INPUT_BYTES) {
    throw new ArtimentPublisherError('payload_too_large', 'Request body is too large.', {
      status: 413,
    })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    throw new ArtimentPublisherError('invalid_json', 'Request body must be valid JSON.', {
      status: 400,
    })
  }

  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload) ||
    !Object.hasOwn(payload, 'value')
  ) {
    throw new ArtimentPublisherError(
      'invalid_request',
      'Request body must contain an editor value.',
      { status: 400 },
    )
  }

  const requestPayload = payload as TRequestPayload
  if (requestPayload.action !== 'updateDocDraft') {
    throw new ArtimentPublisherError('invalid_request', 'Request action must be updateDocDraft.', {
      status: 400,
    })
  }

  requestPayload.variables = readUpdateDocDraftVariables(requestPayload.variables)

  return requestPayload
}

/** Publishes a bounded editor value and persists it through the allowlisted GraphQL action. */
export const handleArtimentPublishRequest = async (
  request: Request,
  { backendToken, fetchImpl, graphqlEndpoint }: TOptions,
): Promise<Response> => {
  try {
    const payload = await readPayload(request)
    const bodyBag = await publishArtiment(payload.value)
    const draft = await updateDocDraftWithBodyBag({
      backendToken,
      bodyBag,
      fetchImpl,
      graphqlEndpoint,
      variables: payload.variables!,
    })

    return jsonResponse({ bodyBag, draft, ok: true })
  } catch (error) {
    if (error instanceof ArtimentPublisherError) return errorResponse(error)

    return jsonResponse(
      {
        error: {
          code: 'internal_error',
          message: 'Failed to publish editor content.',
        },
        ok: false,
      },
      500,
    )
  }
}
