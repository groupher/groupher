import {
  CONTENT_SOURCE_FORMAT,
  type TContentPublishCommand,
  type TContentSource,
} from '@groupher/contracts/content-publish'
import { API_ROUTE } from '@groupher/route-contract'

import { createAuthFetch } from './graphql/client'

export class ContentPublishError extends Error {
  readonly code: string
  readonly details?: unknown
  readonly retryAfter?: number
  readonly status: number

  constructor(
    message: string,
    options: { code: string; details?: unknown; retryAfter?: number; status: number },
  ) {
    super(message)
    this.name = 'ContentPublishError'
    this.message = message
    this.code = options.code
    this.details = options.details
    this.retryAfter = options.retryAfter
    this.status = options.status
  }
}

/** Identifies payload rejections made before the Publisher forwards a command. */
export const isRejectedContentPayload = (error: unknown): boolean =>
  error instanceof ContentPublishError &&
  ['payload_too_large', 'unsupported_media_type', 'invalid_json', 'invalid_request'].includes(
    error.code,
  )

type TPublisherResponse<TResult> = {
  error?: { code?: string; details?: unknown; message?: string }
  ok?: boolean
  result?: TResult
}

const retryAfterSeconds = (value: string | null): number | undefined => {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds
  const retryAt = Date.parse(value)
  if (!Number.isFinite(retryAt)) return undefined
  return Math.max(0, Math.ceil((retryAt - Date.now()) / 1000))
}

/** Converts the editor's persisted JSON value to an explicit Publisher source. */
export const plateSourceFromJson = (body: string): TContentSource => {
  let value: unknown
  try {
    value = JSON.parse(body)
  } catch {
    throw new ContentPublishError('Comment content is not valid editor JSON.', {
      code: 'invalid_value',
      status: 422,
    })
  }
  if (!Array.isArray(value)) {
    throw new ContentPublishError('Comment content must be an editor value.', {
      code: 'invalid_value',
      status: 422,
    })
  }
  return { format: CONTENT_SOURCE_FORMAT.PLATE, value }
}

/** Sends one typed raw-source command to the same-origin trusted Publisher. */
export const publishContentCommand = async <TResult>(
  command: TContentPublishCommand,
): Promise<TResult> => {
  let response: Response
  try {
    response = await createAuthFetch()(API_ROUTE.CONTENT_PUBLISH, {
      body: JSON.stringify(command),
      cache: 'no-store',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
  } catch (cause) {
    throw new ContentPublishError('Content Publisher response is unknown.', {
      code: 'transport_unknown',
      details: cause instanceof Error ? cause.message : undefined,
      status: 0,
    })
  }
  const payload = (await response.json().catch(() => null)) as TPublisherResponse<TResult> | null
  if (!response.ok || !payload?.ok || payload.result === undefined) {
    throw new ContentPublishError(
      payload?.error?.message || 'Content Publisher could not complete the command.',
      {
        code: payload?.error?.code || 'publisher_failure',
        details: payload?.error?.details,
        retryAfter: retryAfterSeconds(response.headers.get('retry-after')),
        status: response.status,
      },
    )
  }
  return payload.result
}
