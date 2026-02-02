import { renderHook } from '@testing-library/react'

import { DEFAULT_ENABLE, MORE_GROUP } from '~/const/dashboard'
import { THREAD } from '~/const/thread'
import type { TCommunityThread, TNameAlias } from '~/spec'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import usePublicThreads from '~/hooks/usePublicThreads'

describe('usePublicThreads', () => {
  it('respects enable + alias and can drop ABOUT when header has extra about', () => {
    const threads: readonly TCommunityThread[] = [
      { slug: THREAD.POST, title: 'Posts', index: 1 },
      { slug: THREAD.ABOUT, title: 'About', index: 2 },
      { slug: THREAD.DOC, title: 'Docs', index: 3 },
    ]

    const nameAlias = [
      { group: 'kanban', slug: THREAD.POST, name: 'Ideas' },
      { group: 'kanban', slug: THREAD.ABOUT, name: 'About (alias)' },
    ] satisfies readonly TNameAlias[]

    const wrapper = makeStoreWrapper({
      community: { slug: 'acme', threads },
      dashboard: {
        enable: { ...DEFAULT_ENABLE, doc: false },
        headerLinks: [{ index: 999, title: '关于', group: MORE_GROUP, link: '/acme/about', groupIndex: 999 }],
        nameAlias,
      },
    })

    const { result } = renderHook(() => usePublicThreads(), { wrapper })
    const slugs = result.current.map((t) => t.slug)

    expect(slugs.includes(THREAD.POST)).toBe(true)
    expect(slugs.includes(THREAD.DOC)).toBe(false)
    expect(slugs.includes(THREAD.ABOUT)).toBe(false)
  })
})
