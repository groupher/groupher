import { ArtimentPublisherError, publishContent } from '@groupher/content-publisher'
import { AUTH_ERROR } from '@groupher/contracts/auth'
import {
  CONTENT_PUBLISH_ERROR_CODE,
  CONTENT_PUBLISH_ACTION,
  CONTENT_PUBLISH_RESOURCE,
  CONTENT_HISTORY_ORIGIN_SCOPE_BY_ACTION,
  CONTENT_SCOPE_BY_ACTION,
  parseContentPublishCommand,
  type TContentPublishCommand,
} from '@groupher/contracts/content-publish'
import { LOCAL_PHOENIX_GRAPHQL_ENDPOINT } from '@groupher/contracts/endpoint'
import { GROUPHER_USER_AUTHORIZATION_HEADER } from '@groupher/contracts/headers'
import {
  CONTENT_PUBLISH_OPERATIONS,
  type TContentPublishOperation,
} from '@groupher/frontend-core/graphql/server-operations'
import { createServiceAuthClientFromEnv, type TServiceAuthClient } from '@groupher/service/auth'
import { print } from 'graphql'

const MAX_REQUEST_BYTES = 2 * 1024 * 1024
const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

type THandlerOptions = {
  backendToken: string
  environment?: Record<string, string | undefined>
  fetcher?: typeof fetch
  logger?: Pick<Console, 'info'>
  serviceAuthClient?: TServiceAuthClient
}

type TGraphQLPayload = {
  data?: Record<string, unknown>
  errors?: Array<{ extensions?: { code?: unknown }; message?: unknown }>
}

const graphQLErrorProjection = (errors: NonNullable<TGraphQLPayload['errors']>) => {
  const codes = new Set(errors.map(({ extensions }) => String(extensions?.code || '')))
  const authCode = [
    AUTH_ERROR.TOKEN_EXPIRED,
    AUTH_ERROR.TOKEN_INVALID,
    AUTH_ERROR.TOKEN_MISSING,
    AUTH_ERROR.SESSION_EXPIRED,
    AUTH_ERROR.SESSION_REVOKED,
  ].find((code) => codes.has(code))
  if (authCode) return { code: authCode, status: 401 }
  if (codes.has('SERVICE_SCOPE_FORBIDDEN')) return { code: 'forbidden', status: 403 }
  if (codes.has('RATE_LIMITED') || codes.has('429')) return { code: 'rate_limited', status: 429 }
  if (codes.has(String(CONTENT_PUBLISH_ERROR_CODE.ARTICLE_WORKING_COPY_REVISION_CONFLICT)))
    return { code: 'revision_conflict', status: 409 }
  if (codes.has('4569')) return { code: 'revision_conflict', status: 409 }
  if (
    codes.has(String(CONTENT_PUBLISH_ERROR_CODE.DRAFT_VERSION_CONFLICT)) ||
    codes.has(String(CONTENT_PUBLISH_ERROR_CODE.COMMENT_BODY_VERSION_CONFLICT))
  )
    return { code: 'version_conflict', status: 409 }
  return { code: 'upstream_graphql_error', status: 422 }
}

type TAdapterOptions = Required<Pick<THandlerOptions, 'backendToken' | 'fetcher'>> & {
  environment: Record<string, string | undefined>
  serviceAuthClient: TServiceAuthClient
}

let serviceAuthClient: TServiceAuthClient | undefined

const failure = (
  status: number,
  code: string,
  message: string,
  details?: unknown,
  headers?: HeadersInit,
): Response =>
  Response.json(
    { error: { code, message, ...(details === undefined ? {} : { details }) }, ok: false },
    { headers: { ...RESPONSE_HEADERS, ...headers }, status },
  )

const readJson = async (request: Request): Promise<unknown | Response> => {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return failure(415, 'unsupported_media_type', 'Content-Type must be application/json.')
  }
  const declaredLength = Number(request.headers.get('content-length') || 0)
  if (declaredLength > MAX_REQUEST_BYTES) {
    return failure(413, 'payload_too_large', 'Content publish request is too large.')
  }
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) {
    return failure(413, 'payload_too_large', 'Content publish request is too large.')
  }
  try {
    return JSON.parse(text)
  } catch {
    return failure(400, 'invalid_json', 'Request body must contain valid JSON.')
  }
}

const phoenixEndpoint = (environment: Record<string, string | undefined>): string =>
  environment.GRAPHQL_ENDPOINT?.trim() ||
  environment.PHOENIX_GRAPHQL_ENDPOINT?.trim() ||
  LOCAL_PHOENIX_GRAPHQL_ENDPOINT

const executeMutation = async ({
  action,
  document,
  field,
  options,
  variables,
}: {
  action: TContentPublishCommand['action']
  document: TContentPublishOperation
  field: string
  options: TAdapterOptions
  variables: Record<string, unknown>
}): Promise<Response> => {
  const historyOriginScope = CONTENT_HISTORY_ORIGIN_SCOPE_BY_ACTION[action]
  const serviceToken = await options.serviceAuthClient.getToken({
    resource: CONTENT_PUBLISH_RESOURCE,
    scopes: historyOriginScope
      ? [CONTENT_SCOPE_BY_ACTION[action], historyOriginScope]
      : [CONTENT_SCOPE_BY_ACTION[action]],
  })
  const fetcher = options.fetcher
  const response = await fetcher(phoenixEndpoint(options.environment), {
    body: JSON.stringify({ query: print(document), variables }),
    cache: 'no-store',
    headers: {
      authorization: `Bearer ${serviceToken}`,
      'content-type': 'application/json',
      [GROUPHER_USER_AUTHORIZATION_HEADER]: `Bearer ${options.backendToken}`,
    },
    method: 'POST',
  })
  const text = await response.text()
  let payload: TGraphQLPayload
  try {
    payload = JSON.parse(text) as TGraphQLPayload
  } catch {
    return failure(
      502,
      'upstream_invalid_response',
      'Content service returned an invalid response.',
    )
  }
  if (payload.errors?.length) {
    const { code, status } = graphQLErrorProjection(payload.errors)
    return failure(
      status,
      code,
      'Content service rejected the command.',
      undefined,
      status === 429 && response.headers.get('retry-after')
        ? { 'Retry-After': response.headers.get('retry-after') as string }
        : undefined,
    )
  }
  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after')
    return failure(
      429,
      'rate_limited',
      'Content service rejected the command.',
      undefined,
      retryAfter ? { 'Retry-After': retryAfter } : undefined,
    )
  }
  if (!response.ok || !payload.data?.[field]) {
    return failure(502, 'upstream_failure', 'Content service could not complete the command.')
  }
  return Response.json({ ok: true, result: payload.data[field] }, { headers: RESPONSE_HEADERS })
}

const graphqlBodyBag = <T extends { thumbnail: unknown }>(bodyBag: T) => ({
  ...bodyBag,
  thumbnail: JSON.stringify(bodyBag.thumbnail ?? null),
})

const createComment = async (
  command: Extract<
    TContentPublishCommand,
    { action: typeof CONTENT_PUBLISH_ACTION.CREATE_COMMENT }
  >,
  options: TAdapterOptions,
): Promise<Response> => {
  const bodyBag = await publishContent(command.payload.content)
  const reply = !!command.target.parentId
  return executeMutation({
    action: command.action,
    document: reply
      ? CONTENT_PUBLISH_OPERATIONS.replyComment
      : CONTENT_PUBLISH_OPERATIONS.createComment,
    field: reply ? 'replyComment' : 'createComment',
    options,
    variables: reply
      ? {
          bodyBag: graphqlBodyBag(bodyBag),
          commandId: command.commandId,
          comment: { article: command.target.article, innerId: command.target.parentId },
        }
      : {
          article: command.target.article,
          bodyBag: graphqlBodyBag(bodyBag),
          commandId: command.commandId,
        },
  })
}

const updateComment = async (
  command: Extract<
    TContentPublishCommand,
    { action: typeof CONTENT_PUBLISH_ACTION.UPDATE_COMMENT }
  >,
  options: TAdapterOptions,
): Promise<Response> => {
  const bodyBag = await publishContent(command.payload.content)
  return executeMutation({
    action: command.action,
    document: CONTENT_PUBLISH_OPERATIONS.updateComment,
    field: 'updateComment',
    options,
    variables: {
      bodyBag: graphqlBodyBag(bodyBag),
      commandId: command.commandId,
      comment: command.target.comment,
      expectedVersion: command.expectedVersion,
    },
  })
}

const createArticle = async (
  command: Extract<
    TContentPublishCommand,
    { action: typeof CONTENT_PUBLISH_ACTION.CREATE_ARTICLE }
  >,
  options: TAdapterOptions,
): Promise<Response> => {
  const bodyBag = await publishContent(command.payload.content)
  return executeMutation({
    action: command.action,
    document: CONTENT_PUBLISH_OPERATIONS.createArticle,
    field: 'createArticle',
    options,
    variables: {
      bodyBag: graphqlBodyBag(bodyBag),
      commandId: command.commandId,
      community: command.target.community,
      copyRight: command.payload.copyRight,
      digest: command.payload.digest,
      coverUrl: command.payload.coverUrl,
      coverUrlDark: command.payload.coverUrlDark,
      linkAddr: command.payload.linkAddr,
      slug: command.payload.slug,
      subtitle: command.payload.subtitle,
      tagIds: command.payload.tagIds,
      templateKey: command.payload.templateKey,
      thread: command.target.thread.toUpperCase(),
      title: command.payload.title,
    },
  })
}

const createAndPublishArticle = async (
  command: Extract<
    TContentPublishCommand,
    { action: typeof CONTENT_PUBLISH_ACTION.CREATE_AND_PUBLISH_ARTICLE }
  >,
  options: TAdapterOptions,
): Promise<Response> => {
  const bodyBag = await publishContent(command.payload.content)
  return executeMutation({
    action: command.action,
    document: CONTENT_PUBLISH_OPERATIONS.createAndPublishArticle,
    field: 'createAndPublishArticle',
    options,
    variables: {
      bodyBag: graphqlBodyBag(bodyBag),
      commandId: command.commandId,
      community: command.target.community,
      copyRight: command.payload.copyRight,
      digest: command.payload.digest,
      coverUrl: command.payload.coverUrl,
      coverUrlDark: command.payload.coverUrlDark,
      linkAddr: command.payload.linkAddr,
      slug: command.payload.slug,
      subtitle: command.payload.subtitle,
      tagIds: command.payload.tagIds,
      templateKey: command.payload.templateKey,
      thread: command.target.thread.toUpperCase(),
      title: command.payload.title,
    },
  })
}

const saveWorkingCopy = async (
  command: Extract<
    TContentPublishCommand,
    { action: typeof CONTENT_PUBLISH_ACTION.SAVE_WORKING_COPY }
  >,
  options: TAdapterOptions,
): Promise<Response> => {
  const bodyBag = await publishContent(command.payload.content)
  return executeMutation({
    action: command.action,
    document: CONTENT_PUBLISH_OPERATIONS.saveWorkingCopy,
    field: 'saveWorkingCopy',
    options,
    variables: {
      articleId: command.target.articleId,
      bodyBag: graphqlBodyBag(bodyBag),
      commandId: command.commandId,
      community: command.target.community,
      copyRight: command.payload.copyRight,
      digest: command.payload.digest,
      coverUrl: command.payload.coverUrl,
      coverUrlDark: command.payload.coverUrlDark,
      linkAddr: command.payload.linkAddr,
      revision: command.revision,
      slug: command.payload.slug,
      subtitle: command.payload.subtitle,
      tagIds: command.payload.tagIds,
      title: command.payload.title,
      templateKey: command.payload.templateKey,
      workingCopyId: command.target.workingCopyId,
    },
  })
}

const saveDocQueueCopy = async (
  command: Extract<
    TContentPublishCommand,
    { action: typeof CONTENT_PUBLISH_ACTION.SAVE_DOC_QUEUE_COPY }
  >,
  options: TAdapterOptions,
): Promise<Response> => {
  const bodyBag = await publishContent(command.payload.content)
  return executeMutation({
    action: command.action,
    document: CONTENT_PUBLISH_OPERATIONS.saveDocsQueueCopy,
    field: 'saveDocsQueueCopy',
    options,
    variables: {
      articleId: command.target.articleId,
      bodyBag: graphqlBodyBag(bodyBag),
      commandId: command.commandId,
      community: command.target.community,
      queueRevision: command.queueRevision,
      workingCopyRevision: command.revision,
      title: command.payload.title,
      subtitle: command.payload.subtitle,
      slug: command.payload.slug,
    },
  })
}

/** Authenticated same-origin Content Publisher HTTP boundary. */
export const handleContentPublishRequest = async (
  request: Request,
  options: THandlerOptions,
): Promise<Response> => {
  if (request.method !== 'POST')
    return failure(405, 'method_not_allowed', 'Only POST is supported.')
  const input = await readJson(request)
  if (input instanceof Response) return input
  const parsed = parseContentPublishCommand(input)
  if (!parsed.ok)
    return failure(422, 'invalid_request', 'Content publish command is invalid.', parsed.issues)

  const environment = options.environment ?? process.env
  const fetcher = options.fetcher ?? fetch
  try {
    const client =
      options.serviceAuthClient ||
      (serviceAuthClient ??= createServiceAuthClientFromEnv(environment, fetcher))
    ;(options.logger ?? console).info('content_publish_command', {
      action: parsed.value.action,
      commandId: parsed.value.commandId,
      delegatedUser: true,
      serviceClient: environment.SERVICE_AUTH_CLIENT_ID || 'configured-service-client',
      target: parsed.value.target,
    })
    switch (parsed.value.action) {
      case CONTENT_PUBLISH_ACTION.CREATE_COMMENT:
        return await createComment(parsed.value, {
          backendToken: options.backendToken,
          environment,
          fetcher,
          serviceAuthClient: client,
        })
      case CONTENT_PUBLISH_ACTION.UPDATE_COMMENT:
        return await updateComment(parsed.value, {
          backendToken: options.backendToken,
          environment,
          fetcher,
          serviceAuthClient: client,
        })
      case CONTENT_PUBLISH_ACTION.CREATE_ARTICLE:
        return await createArticle(parsed.value, {
          backendToken: options.backendToken,
          environment,
          fetcher,
          serviceAuthClient: client,
        })
      case CONTENT_PUBLISH_ACTION.SAVE_WORKING_COPY:
        return await saveWorkingCopy(parsed.value, {
          backendToken: options.backendToken,
          environment,
          fetcher,
          serviceAuthClient: client,
        })
      case CONTENT_PUBLISH_ACTION.SAVE_DOC_QUEUE_COPY:
        return await saveDocQueueCopy(parsed.value, {
          backendToken: options.backendToken,
          environment,
          fetcher,
          serviceAuthClient: client,
        })
      case CONTENT_PUBLISH_ACTION.CREATE_AND_PUBLISH_ARTICLE:
        return await createAndPublishArticle(parsed.value, {
          backendToken: options.backendToken,
          environment,
          fetcher,
          serviceAuthClient: client,
        })
    }
  } catch (error) {
    if (error instanceof ArtimentPublisherError)
      return failure(error.status, error.code, error.message, error.diagnostics)
    console.error('content_publish_failed', {
      action: parsed.value.action,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : 'Unexpected publisher failure.',
    })
    return failure(502, 'publisher_unavailable', 'Content Publisher is temporarily unavailable.')
  }
}
