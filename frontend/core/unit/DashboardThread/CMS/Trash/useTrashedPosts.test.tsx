import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import S from '~/unit/DashboardThread/schema/content'

import useTrashedPosts from './useTrashedPosts'

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  query: vi.fn(),
  toast: vi.fn(),
}))

vi.mock('~/graphql/client', () => ({
  browserQuery: (document: { definitions?: Array<{ operation?: string }> }, ...args: unknown[]) =>
    document.definitions?.some((definition) => definition.operation === 'mutation')
      ? mocks.mutate(document, ...args)
      : mocks.query(document, ...args),
}))

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: (key: string) => key }),
}))

vi.mock('~/stores/community/hooks', () => ({
  default: () => ({ slug: 'home' }),
}))

vi.mock('~/ui/Toaster', () => ({ toast: mocks.toast }))

const page = {
  entries: [
    {
      id: 'trash-1',
      thread: 'POST',
      articleRef: 'article-1',
      article: { innerId: '1', title: 'Deleted post' },
      deletedBy: null,
      deletedAt: '2026-07-14T00:00:00Z',
      scheduledPermanentDeletionAt: '2026-08-13T00:00:00Z',
      mentionedByCount: 2,
    },
  ],
  pageNumber: 1,
  pageSize: 20,
  totalCount: 1,
  totalPages: 1,
}

describe('useTrashedPosts', () => {
  beforeEach(() => {
    mocks.mutate.mockReset()
    mocks.query.mockReset()
    mocks.toast.mockReset()
    mocks.query.mockResolvedValue({ trashedArticles: page })
  })

  it('loads the current community Trash page', async () => {
    const { result } = renderHook(() => useTrashedPosts())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mocks.query).toHaveBeenCalledWith(S.trashedPosts, {
      community: 'home',
      page: 1,
      size: 20,
    })
    expect(result.current.pagedPosts.entries[0]?.id).toBe('trash-1')
  })

  it('restores a row and reloads the current page', async () => {
    mocks.mutate.mockResolvedValue({ restoreTrashedArticle: { innerId: '1' } })
    const { result } = renderHook(() => useTrashedPosts())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      expect(await result.current.restore('trash-1')).toBe(true)
    })

    expect(mocks.mutate).toHaveBeenCalledWith(S.restoreTrashedPost, {
      community: 'home',
      id: 'trash-1',
    })
    expect(mocks.query).toHaveBeenCalledTimes(2)
    expect(mocks.toast).toHaveBeenCalledWith('dsb.cms.trash.restored')
  })

  it('permanently deletes a row and reloads the current page', async () => {
    mocks.mutate.mockResolvedValue({ permanentlyDeleteTrashedArticle: { done: true } })
    const { result } = renderHook(() => useTrashedPosts())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      expect(await result.current.permanentlyDelete('trash-1')).toBe(true)
    })

    expect(mocks.mutate).toHaveBeenCalledWith(S.permanentlyDeleteTrashedPost, {
      community: 'home',
      id: 'trash-1',
    })
    expect(mocks.query).toHaveBeenCalledTimes(2)
    expect(mocks.toast).toHaveBeenCalledWith('dsb.cms.trash.permanently_deleted')
  })
})
