import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { parse } from 'graphql'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => new Request('https://groupher.test/apply'),
  setResponseHeader: vi.fn(),
}))

import { requestGraphQL } from './graphql'

afterEach(() => vi.unstubAllGlobals())

it('bounds the GraphQL request and propagates an upstream timeout', async () => {
  const controller = new AbortController()
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal)
  const fetcher = vi.fn(
    (_url: string | URL | Request, options?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new Error('upstream timed out')))
      }),
  )
  vi.stubGlobal('fetch', fetcher)

  const request = requestGraphQL(parse('{ __typename }') as TypedDocumentNode, {})
  expect(timeout).toHaveBeenCalledWith(10_000)
  expect(fetcher).toHaveBeenCalledOnce()
  expect(fetcher.mock.calls[0][1]?.signal).toBe(controller.signal)
  const rejection = expect(request).rejects.toBeDefined()
  controller.abort()
  await rejection
})
