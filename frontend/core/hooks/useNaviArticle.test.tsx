import { renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { THREAD } from '~/const/thread'
import {
  PagedChangelogsContext,
  type TPagedChangelogsResult,
} from '~/hooks/usePagedChangelogs/context'
import { PagedPostsContext, type TPagedPostsResult } from '~/hooks/usePagedPosts/context'

import useNaviArticle from './useNaviArticle'

const state = vi.hoisted(() => ({ thread: 'POST', article: { id: 'middle' } }))
vi.mock('~/hooks/useViewingThread', () => ({ default: () => state.thread }))
vi.mock('~/hooks/useViewingArticle', () => ({ default: () => ({ article: state.article }) }))

const articles = ['first', 'middle', 'last'].map((id) => ({ content: { id } }))
let posts: TPagedPostsResult | null
let changelogs: TPagedChangelogsResult | null
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(
    PagedPostsContext.Provider,
    { value: posts },
    createElement(PagedChangelogsContext.Provider, { value: changelogs }, children),
  )

beforeEach(() => {
  state.thread = THREAD.POST
  state.article = { id: 'middle' }
  posts = { pagedPosts: { entries: articles } } as unknown as TPagedPostsResult
  changelogs = { pagedChangelogs: { entries: articles } } as unknown as TPagedChangelogsResult
})

describe('preview article navigation', () => {
  it('uses content identities from the current Post page and updates with that page', () => {
    const { result, rerender } = renderHook(useNaviArticle, { wrapper })
    expect(result.current).toEqual({ previous: { id: 'first' }, next: { id: 'last' } })
    posts = { pagedPosts: { entries: articles.slice(1) } } as unknown as TPagedPostsResult
    rerender()
    expect(result.current).toEqual({ previous: null, next: { id: 'last' } })
  })

  it('reads Changelog neighbors from its own page', () => {
    state.thread = THREAD.CHANGELOG
    posts = null
    expect(renderHook(useNaviArticle, { wrapper }).result.current).toEqual({
      previous: { id: 'first' },
      next: { id: 'last' },
    })
  })

  it('does not invent a next Article when the current Article is absent from the loaded page', () => {
    state.article = { id: 'elsewhere' }
    expect(renderHook(useNaviArticle, { wrapper }).result.current).toEqual({
      previous: null,
      next: null,
    })
  })

  it('allows a standalone detail without a list provider', () => {
    expect(renderHook(useNaviArticle).result.current).toEqual({ previous: null, next: null })
  })
})
