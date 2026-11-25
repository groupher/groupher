import { CONTENT_PUBLISH_ACTION, CONTENT_SOURCE_FORMAT } from '@groupher/contracts/content-publish'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ContentPublishError, publishContentCommand } from './contentPublisher'

const command = {
  action: CONTENT_PUBLISH_ACTION.SAVE_WORKING_COPY,
  commandId: '00000000-0000-4000-8000-000000000001',
  revision: 1,
  payload: {
    content: {
      format: CONTENT_SOURCE_FORMAT.PLATE,
      value: [{ children: [{ text: 'Draft' }], type: 'p' }],
    },
    slug: 'draft',
    subtitle: '',
    title: 'Draft',
  },
  target: { community: 'home', articleId: 'doc-id', workingCopyId: 'work-id' },
} as const

describe('publishContentCommand', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('retains an unknown outcome when a response body cannot be decoded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{broken', { status: 200 })),
    )
    await expect(publishContentCommand(command)).rejects.toMatchObject({
      code: 'transport_unknown',
      status: 200,
    } satisfies Partial<ContentPublishError>)
  })

  it.each([
    Response.json(
      { error: { code: 'upstream_failure', message: 'failed' }, ok: false },
      { status: 502 },
    ),
    Response.json({ ok: true }, { status: 200 }),
  ])('treats an upstream failure or incomplete success as an unknown outcome', async (response) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response),
    )
    await expect(publishContentCommand(command)).rejects.toMatchObject({
      code: 'transport_unknown',
      status: response.status,
    })
  })

  it('parses Retry-After delay seconds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { error: { code: 'rate_limited', message: 'slow down' }, ok: false },
          { headers: { 'Retry-After': '17' }, status: 429 },
        ),
      ),
    )

    await expect(publishContentCommand(command)).rejects.toMatchObject({
      retryAfter: 17,
      status: 429,
    } satisfies Partial<ContentPublishError>)
  })

  it('parses Retry-After HTTP dates', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-16T08:00:00.000Z'))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { error: { code: 'rate_limited', message: 'slow down' }, ok: false },
          {
            headers: { 'Retry-After': 'Fri, 16 Oct 2026 08:00:17 GMT' },
            status: 429,
          },
        ),
      ),
    )

    await expect(publishContentCommand(command)).rejects.toMatchObject({
      retryAfter: 17,
      status: 429,
    } satisfies Partial<ContentPublishError>)
  })
})
