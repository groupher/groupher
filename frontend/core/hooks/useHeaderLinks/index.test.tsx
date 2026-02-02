import { renderHook } from '@testing-library/react'

import { MORE_GROUP } from '~/const/dashboard'
import { THREAD } from '~/const/thread'
import type { TCommunityThread } from '~/spec'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useHeaderLinks from '~/hooks/useHeaderLinks'

describe('useHeaderLinks', () => {
  it('adds About + Dashboard links for moderators', () => {
    const threads: readonly TCommunityThread[] = [
      { slug: THREAD.POST, title: 'Posts', index: 1 },
      { slug: THREAD.ABOUT, title: 'About', index: 2 },
    ]

    const wrapper = makeStoreWrapper({
      community: { slug: 'acme', threads },
      dashboard: {
        headerLinks: [{ index: 1, title: 'Docs', group: 'DOC', link: '/docs', groupIndex: 1 }],
      },
    })

    const { result } = renderHook(() => useHeaderLinks(), { wrapper })
    const custom = result.current.getCustomLinks()

    expect(custom.some((l) => l.title === '关于')).toBe(true)
    expect(custom.some((l) => l.title === '控制台')).toBe(true)

    const grouped = result.current.getGroupedLinks()
    expect(grouped.groupKeys.includes(MORE_GROUP)).toBe(true)
  })
})
