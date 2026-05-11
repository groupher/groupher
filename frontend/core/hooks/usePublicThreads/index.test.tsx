import { renderHook } from '@testing-library/react'

import { DEFAULT_ENABLE } from '~/const/dashboard'
import { THREAD_PATH } from '~/const/thread'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import usePublicThreads from '~/hooks/usePublicThreads'
import type { TCommunityThread, TNameAlias } from '~/spec'

describe('usePublicThreads', () => {
  const threads: readonly TCommunityThread[] = [
    { slug: THREAD_PATH.POST, title: 'Posts', index: 1 },
    { slug: THREAD_PATH.ABOUT, title: 'About', index: 2 },
    { slug: THREAD_PATH.DOC, title: 'Docs', index: 3 },
  ]

  const nameAlias = [
    { group: 'kanban', slug: THREAD_PATH.POST, name: 'Ideas' },
    { group: 'kanban', slug: THREAD_PATH.ABOUT, name: 'About (alias)' },
  ] satisfies readonly TNameAlias[]

  it('respects enable + alias and keeps ABOUT on main axis by default', () => {
    const wrapper = makeStoreWrapper({
      community: { slug: 'acme', threads },
      dashboard: {
        enable: { ...DEFAULT_ENABLE, doc: false },
        headerLinks: [],
        nameAlias,
      },
    })

    const { result } = renderHook(() => usePublicThreads(), { wrapper })
    const slugs = result.current.map((t) => t.slug)

    expect(slugs.includes(THREAD_PATH.POST)).toBe(true)
    expect(slugs.includes(THREAD_PATH.DOC)).toBe(false)
    expect(slugs.includes(THREAD_PATH.ABOUT)).toBe(true)
  })

  it('drops ABOUT on main axis when custom main links exist', () => {
    const wrapper = makeStoreWrapper({
      community: { slug: 'acme', threads },
      dashboard: {
        enable: { ...DEFAULT_ENABLE, doc: false },
        headerLinks: [{ id: 'docs', type: 'LINK', title: 'Docs Link', url: '/docs' }],
        nameAlias,
      },
    })

    const { result } = renderHook(() => usePublicThreads(), { wrapper })
    const slugs = result.current.map((t) => t.slug)

    expect(slugs.includes(THREAD_PATH.ABOUT)).toBe(false)
  })

  it('keeps ABOUT when persisted data only contains system ABOUT', () => {
    const wrapper = makeStoreWrapper({
      community: { slug: 'acme', threads },
      dashboard: {
        enable: { ...DEFAULT_ENABLE, doc: false },
        headerLinks: [{ id: 'about-menu', type: 'LINK', title: 'About menu', url: '/acme/about' }],
        nameAlias,
      },
    })

    const { result } = renderHook(() => usePublicThreads(), { wrapper })
    const slugs = result.current.map((t) => t.slug)

    expect(slugs.includes(THREAD_PATH.POST)).toBe(true)
    expect(slugs.includes(THREAD_PATH.DOC)).toBe(false)
    expect(slugs.includes(THREAD_PATH.ABOUT)).toBe(true)
  })
})
