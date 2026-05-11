import { renderHook } from '@testing-library/react'

import { ROUTE } from '~/const/route'
import { THREAD_PATH } from '~/const/thread'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useHeaderLinks from '~/hooks/useHeaderLinks'
import { HEADER_LINK_TYPE, MORE_TAB } from '~/hooks/useHeaderLinks/constant'
import { isMoreTabGroup } from '~/hooks/useHeaderLinks/helper'
import type { TCommunityThread } from '~/spec'

describe('useHeaderLinks', () => {
  it('keeps ABOUT on main axis when no custom main links exist', () => {
    const threads: readonly TCommunityThread[] = [
      { slug: THREAD_PATH.POST, title: 'Posts', index: 1 },
      { slug: THREAD_PATH.ABOUT, title: 'About', index: 2 },
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

    expect(custom.some((l) => l.type === HEADER_LINK_TYPE.LINK && l.url === aboutPath)).toBe(false)
    expect(custom.some(isMoreTabGroup)).toBe(false)
  })

  it('folds ABOUT to MORE when custom main links exist', () => {
    const threads: readonly TCommunityThread[] = [
      { slug: THREAD_PATH.POST, title: 'Posts', index: 1 },
      { slug: THREAD_PATH.ABOUT, title: 'About', index: 2 },
    ]

    const wrapper = makeStoreWrapper({
      community: { slug: 'acme', threads },
      dashboard: {
        headerLinks: [{ id: 'docs', type: HEADER_LINK_TYPE.LINK, title: 'Docs', url: '/docs' }],
      },
    })

    const { result } = renderHook(() => useHeaderLinks(), { wrapper })
    const custom = result.current.getCustomLinks()
    const aboutPath = `/acme/${ROUTE.ABOUT}`

    const more = custom.find(isMoreTabGroup)
    expect(more?.links.some((l) => l.url === aboutPath)).toBe(true)
  })

  it('drops persisted ABOUT links from custom links', () => {
    const wrapper = makeStoreWrapper({
      community: { slug: 'acme', threads: [] },
      dashboard: {
        headerLinks: [
          {
            id: 'about-custom',
            type: HEADER_LINK_TYPE.LINK,
            title: 'About menu',
            url: '/acme/about',
          },
        ],
      },
    })

    const { result } = renderHook(() => useHeaderLinks(), { wrapper })
    const custom = result.current.getCustomLinks()
    const aboutLinks = custom.filter(
      (l) =>
        (l.type === HEADER_LINK_TYPE.LINK && l.url === '/acme/about') ||
        (isMoreTabGroup(l) && l.links.some((item) => item.url === '/acme/about')),
    )

    expect(aboutLinks).toHaveLength(0)
    expect(custom.some((l) => l.type === HEADER_LINK_TYPE.LINK && l.url === '/acme/about')).toBe(
      false,
    )
  })

  it('keeps custom MORE links before fixed system links', () => {
    const wrapper = makeStoreWrapper({
      community: { slug: 'acme', threads: [] },
      dashboard: {
        headerLinks: [
          {
            id: 'custom:more',
            type: HEADER_LINK_TYPE.GROUP,
            title: MORE_TAB.TITLE_KEY,
            links: [{ id: 'community', title: 'Community', url: '/community' }],
          },
        ],
      },
    })

    const { result } = renderHook(() => useHeaderLinks(), { wrapper })
    const more = result.current.getCustomLinks().find(isMoreTabGroup)

    expect(more?.links.map((link) => link.id)).toEqual(['community', MORE_TAB.ABOUT_ID])
  })

  it('drops persisted MORE when it only contains system links', () => {
    const wrapper = makeStoreWrapper({
      community: { slug: 'acme', threads: [] },
      dashboard: {
        headerLinks: [
          {
            id: 'custom:more',
            type: HEADER_LINK_TYPE.GROUP,
            title: MORE_TAB.TITLE_KEY,
            links: [{ id: 'about', title: 'About', url: '/acme/about' }],
          },
        ],
      },
    })

    const { result } = renderHook(() => useHeaderLinks(), { wrapper })
    const more = result.current.getCustomLinks().find(isMoreTabGroup)

    expect(more).toBeUndefined()
  })

  it('ignores legacy flat header link data', () => {
    const wrapper = makeStoreWrapper({
      community: { slug: 'acme', threads: [] },
      dashboard: {
        headerLinks: [
          {
            id: 'legacy',
            title: 'Legacy',
            link: '/legacy',
            group: 'Legacy Group',
            groupIndex: 0,
            index: 0,
          },
        ] as never,
      },
    })

    const { result } = renderHook(() => useHeaderLinks(), { wrapper })

    expect(result.current.getCustomLinks()).toEqual([])
  })
})
