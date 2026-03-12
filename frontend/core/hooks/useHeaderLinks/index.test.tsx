import { renderHook } from '@testing-library/react'

import { MORE_GROUP } from '~/const/dashboard'
import { ROUTE } from '~/const/route'
import { THREAD } from '~/const/thread'
import type { TCommunityThread } from '~/spec'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useHeaderLinks from '~/hooks/useHeaderLinks'

describe('useHeaderLinks', () => {
  it('keeps ABOUT on main axis when no custom main links exist', () => {
    const threads: readonly TCommunityThread[] = [
      { slug: THREAD.POST, title: 'Posts', index: 1 },
      { slug: THREAD.ABOUT, title: 'About', index: 2 },
    ]

    const wrapper = makeStoreWrapper({
      community: { slug: 'acme', threads },
      dashboard: {
        headerLinks: [],
      },
    })

    const { result } = renderHook(() => useHeaderLinks(), { wrapper })
    const custom = result.current.getCustomLinks()
    const aboutPath = `/acme/${ROUTE.ABOUT}`

    expect(custom.some((l) => l.link === aboutPath)).toBe(false)
    expect(custom.some((l) => l.title === '控制台')).toBe(true)
  })

  it('folds ABOUT to MORE when custom main links exist', () => {
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
    const aboutPath = `/acme/${ROUTE.ABOUT}`

    expect(custom.some((l) => l.link === aboutPath)).toBe(true)

    const grouped = result.current.getGroupedLinks()
    expect(grouped.groupKeys.includes(MORE_GROUP)).toBe(true)
  })

  it('does not duplicate ABOUT in MORE when an about link already exists', () => {
    const wrapper = makeStoreWrapper({
      community: { slug: 'acme', threads: [] },
      dashboard: {
        headerLinks: [
          {
            index: 1,
            title: 'About menu',
            group: MORE_GROUP,
            link: '/acme/about',
            groupIndex: 1,
          },
        ],
      },
    })

    const { result } = renderHook(() => useHeaderLinks(), { wrapper })
    const custom = result.current.getCustomLinks()
    const aboutLinks = custom.filter((l) => l.link === '/acme/about')

    expect(aboutLinks).toHaveLength(1)
  })
})
