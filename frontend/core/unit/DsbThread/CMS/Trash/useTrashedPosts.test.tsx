import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import S from '~/unit/DsbThread/schema/content'

import useTrashedPosts from './useTrashedPosts'

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  query: vi.fn(),
  toast: vi.fn(),
  community: 'home',
}))

vi.mock('~/graphql/client', () => ({
  browserGraphQLRequest: (
    document: { definitions?: Array<{ operation?: string }> },
    ...args: unknown[]
  ) =>
    document.definitions?.some((definition) => definition.operation === 'mutation')
      ? mocks.mutate(document, ...args)
      : mocks.query(document, ...args),
}))

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: (key: string) => key }),
}))

vi.mock('~/stores/community/hooks', () => ({
  default: () => ({ slug: mocks.community }),
}))

vi.mock('~/stores/account/hooks', () => ({ default: () => ({ accountScope: 'viewer-1' }) }))

vi.mock('~/ui/Toaster', () => ({ toast: mocks.toast }))

const page = {
  entries: [
    {
      id: 'trash-1',
      thread: 'POST',
      articleId: 'article-1',
      article: { innerId: '1', title: 'Deleted post' },
      stats: null,
      deletedBy: null,
      deletedAt: '2026-07-14T00:00:00Z',
      scheduledPermanentDeletionAt: '2026-08-13T00:00:00Z',
      mentionedByCount: 2,
    },
  ],
  pageInfo: {
    __typename: 'OffsetPageInfo' as const,
    page: 1,
    size: 20,
    totalCount: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  },
}

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client }, children)
let client: QueryClient

describe('useTrashedPosts', () => {
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
    mocks.community = 'home'
    mocks.mutate.mockReset()
    mocks.query.mockReset()
    mocks.toast.mockReset()
    mocks.query.mockResolvedValue({ trashedArticles: page })
  })

  it('loads the current community Trash page', async () => {
    const { result } = renderHook(() => useTrashedPosts(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mocks.query).toHaveBeenCalledWith(S.trashedPosts, {
      community: 'home',
      pagi: { offset: { page: 1, size: 20 } },
    })
    expect(result.current.pagedPosts.entries[0]?.id).toBe('trash-1')
  })

  it('isolates initial data across communities and exposes a recoverable page failure', async () => {
    const { result, rerender } = renderHook(() => useTrashedPosts(page as never), { wrapper })
    expect(result.current.pagedPosts.entries[0]?.id).toBe('trash-1')
    mocks.query.mockRejectedValueOnce(new Error('failed'))
    mocks.community = 'other'
    rerender()
    expect(result.current.pagedPosts.entries).toEqual([])
    await waitFor(() => expect(result.current.error).not.toBeNull())
    await act(async () => {
      await result.current.retry()
    })
    await waitFor(() => expect(result.current.error).toBeNull())
    expect(mocks.query).toHaveBeenLastCalledWith(S.trashedPosts, {
      community: 'other',
      pagi: { offset: { page: 1, size: 20 } },
    })
  })

  it('restores a row and reloads the current page', async () => {
    mocks.mutate.mockResolvedValue({ restoreTrashedArticle: { innerId: '1' } })
    const { result } = renderHook(() => useTrashedPosts(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      expect(await result.current.restore('trash-1')).toBe(true)
    })

    expect(mocks.mutate).toHaveBeenCalledWith(
      S.restoreTrashedPost,
      expect.objectContaining({
        community: 'home',
        id: 'trash-1',
        commandId: expect.any(String),
      }),
    )
    expect(mocks.query).toHaveBeenCalledTimes(2)
    expect(mocks.toast).toHaveBeenCalledWith('dsb.cms.trash.restored')
  })

  it('permanently deletes a row and reloads the current page', async () => {
    mocks.mutate.mockResolvedValue({
      permanentlyDeleteTrashedArticle: { done: true },
    })
    const { result } = renderHook(() => useTrashedPosts(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      expect(await result.current.permanentlyDelete('trash-1')).toBe(true)
    })

    expect(mocks.mutate).toHaveBeenCalledWith(
      S.permanentlyDeleteTrashedPost,
      expect.objectContaining({
        community: 'home',
        id: 'trash-1',
        commandId: expect.any(String),
      }),
    )
    expect(mocks.query).toHaveBeenCalledTimes(2)
    expect(mocks.toast).toHaveBeenCalledWith('dsb.cms.trash.permanently_deleted')
  })
})
