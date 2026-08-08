import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PHASE } from './constant'
import type { TContentImportJob, TDocImportPreview } from './spec'
import useLogic from './useLogic'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  query: vi.fn(),
  searchParams: '',
  t: (key: string) => key,
}))

vi.mock('~/platform', async () => {
  const actual = await vi.importActual<typeof import('~/platform')>('~/platform')
  return {
    ...actual,
    useSearchParams: () => new URLSearchParams(mocks.searchParams),
  }
})

vi.mock('~/hooks/useGraphQLClient', () => ({
  default: () => ({ query: mocks.query }),
}))

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: mocks.t }),
}))

vi.mock('~/stores/community/hooks', () => ({
  default: () => ({ slug: 'home' }),
}))

const jsonResponse = (data: unknown): Response =>
  new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })

const preview = {
  previewRef: 'preview-1',
  sourceInfo: { repoUrl: 'https://github.com/groupher/docs' },
} as TDocImportPreview

const job = {
  id: 'job-1',
  process: {
    progress: { completed: 2, total: 2, unit: 'DOCUMENT' },
    recentBatch: [],
    stage: 'APPLYING',
    state: 'RUNNING',
    updatedAt: '2026-07-22T08:00:00.000Z',
  },
  status: 'ready',
} as unknown as TContentImportJob

describe('useLogic apply', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    mocks.searchParams = ''
    vi.stubGlobal('fetch', mocks.fetch)
    mocks.fetch.mockReset()
    mocks.query.mockReset()
    mocks.query.mockResolvedValue({ contentImportJob: job })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the starting state immediately and begins one job query after apply returns', async () => {
    let resolveApply: (response: Response) => void = () => undefined
    const applyResponse = new Promise<Response>((resolve) => {
      resolveApply = resolve
    })

    mocks.fetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url === '/api/docs/import/previews' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ previewRef: preview.previewRef }))
      }
      if (url.includes(`/${preview.previewRef}/apply`)) return applyResponse
      if (url.includes(`/${preview.previewRef}?`)) {
        return Promise.resolve(jsonResponse({ preview, status: 'ready' }))
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })

    const { result } = renderHook(() => useLogic())

    await act(async () => {
      await result.current.analyze()
    })
    await waitFor(() => expect(result.current.phase).toBe(PHASE.REVIEW))

    let operation: Promise<void> = Promise.resolve()
    act(() => {
      operation = result.current.apply(['page-a', 'page-b'])
    })

    expect(result.current.phase).toBe(PHASE.IMPORTING)
    expect(result.current.process).toMatchObject({
      progress: { completed: 0, total: 2, unit: 'document' },
      stage: 'preparing',
    })
    expect(result.current.job).toBeNull()
    expect(mocks.query).not.toHaveBeenCalled()

    resolveApply(jsonResponse({ jobRef: job.id, status: job.status }))
    await act(async () => {
      await operation
    })
    await waitFor(() => expect(result.current.job?.id).toBe(job.id))

    expect(result.current.process).toMatchObject({
      progress: { completed: 2, total: 2, unit: 'document' },
      stage: 'applying',
    })

    expect(mocks.query).toHaveBeenCalledTimes(1)
  })

  it('uses the Preview Process returned by the polling API', async () => {
    mocks.fetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url === '/api/docs/import/previews' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ previewRef: preview.previewRef }))
      }
      if (url.includes(`/${preview.previewRef}?`)) {
        return Promise.resolve(
          jsonResponse({
            process: {
              recentBatch: [],
              stage: 'building_preview',
              state: 'running',
              updatedAt: '2026-07-22T08:00:00.000Z',
            },
            status: 'running',
          }),
        )
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })

    const { result } = renderHook(() => useLogic())

    await act(async () => {
      await result.current.analyze()
    })

    await waitFor(() => expect(result.current.process?.stage).toBe('building_preview'))
    expect(result.current.phase).toBe(PHASE.ANALYZING)
  })

  it('keeps authoritative Preview state running through a transient polling failure', async () => {
    mocks.fetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url === '/api/docs/import/previews' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ previewRef: preview.previewRef }))
      }
      if (url.includes(`/${preview.previewRef}?`)) {
        return Promise.reject(new Error('Network unavailable'))
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })

    const { result } = renderHook(() => useLogic())

    await act(async () => {
      await result.current.analyze()
    })

    await waitFor(() => expect(result.current.pollingDisconnected).toBe(true))
    expect(result.current.phase).toBe(PHASE.ANALYZING)
    expect(result.current.process?.stage).toBe('analyzing')
  })

  it('returns cleanup success and removes both Preview and Job URL state', async () => {
    mocks.searchParams = `preview=${preview.previewRef}&job=${job.id}`
    window.history.replaceState(null, '', `/?${mocks.searchParams}`)
    mocks.fetch.mockResolvedValue(jsonResponse({ ok: true }))

    const { result } = renderHook(() => useLogic())

    let canLeave = false
    await act(async () => {
      canLeave = await result.current.reset()
    })

    expect(canLeave).toBe(true)
    expect(result.current.phase).toBe(PHASE.REPO)
    expect(mocks.fetch).toHaveBeenCalledWith(
      `/api/docs/import/previews/${preview.previewRef}?community=home`,
      { method: 'DELETE' },
    )
    expect(window.location.search).toBe('')
  })

  it('waits for an in-flight apply admission before deleting the Preview', async () => {
    let resolveApply: (response: Response) => void = () => undefined
    const applyResponse = new Promise<Response>((resolve) => {
      resolveApply = resolve
    })

    mocks.fetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/docs/import/previews' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ previewRef: preview.previewRef }))
      }
      if (url.includes(`/${preview.previewRef}/apply`)) return applyResponse
      if (url.includes(`/${preview.previewRef}?`) && init?.method === 'DELETE') {
        return Promise.resolve(jsonResponse({ ok: true }))
      }
      if (url.includes(`/${preview.previewRef}?`)) {
        return Promise.resolve(jsonResponse({ preview, status: 'ready' }))
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })

    const { result } = renderHook(() => useLogic())
    await act(async () => result.current.analyze())
    await waitFor(() => expect(result.current.phase).toBe(PHASE.REVIEW))

    let applyOperation: Promise<void> = Promise.resolve()
    let resetOperation: Promise<boolean> = Promise.resolve(false)
    act(() => {
      applyOperation = result.current.apply(['page-a'])
      resetOperation = result.current.reset()
    })

    await Promise.resolve()
    expect(
      mocks.fetch.mock.calls.some(
        ([, init]) => (init as RequestInit | undefined)?.method === 'DELETE',
      ),
    ).toBe(false)

    resolveApply(jsonResponse({ jobRef: job.id, status: job.status }))
    await act(async () => {
      await applyOperation
      await expect(resetOperation).resolves.toBe(true)
    })

    const applyCall = mocks.fetch.mock.calls.findIndex(([url]) => String(url).endsWith('/apply'))
    const deleteCall = mocks.fetch.mock.calls.findIndex(
      ([, init]) => (init as RequestInit | undefined)?.method === 'DELETE',
    )
    expect(deleteCall).toBeGreaterThan(applyCall)
  })
})
