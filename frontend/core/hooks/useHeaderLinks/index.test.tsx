import { renderHook } from '@testing-library/react'

import { ROUTE } from '~/const/route'
import { THREAD_PATH } from '~/const/thread'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useHeaderLinks from '~/hooks/useHeaderLinks'
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

    expect(custom.some((l) => l.type === 'LINK' && l.url === aboutPath)).toBe(false)
    expect(custom.some((l) => l.type === 'system-group')).toBe(false)
  })

  it('folds ABOUT to MORE when custom main links exist', () => {
    const threads: readonly TCommunityThread[] = [
      { slug: THREAD_PATH.POST, title: 'Posts', index: 1 },
      { slug: THREAD_PATH.ABOUT, title: 'About', index: 2 },
    ]

    const wrapper = makeStoreWrapper({
      community: { slug: 'acme', threads },
      dashboard: {
        headerLinks: [{ id: 'docs', type: 'LINK', title: 'Docs', url: '/docs' }],
      },
    })

    const { result } = renderHook(() => useHeaderLinks(), { wrapper })
    const custom = result.current.getCustomLinks()
    const aboutPath = `/acme/${ROUTE.ABOUT}`

    const more = custom.find((l) => l.type === 'system-group')
    expect(more?.links.some((l) => l.url === aboutPath)).toBe(true)
  })

  it('drops persisted ABOUT links from custom links', () => {
    const wrapper = makeStoreWrapper({
      community: { slug: 'acme', threads: [] },
      dashboard: {
        headerLinks: [
          { id: 'about-custom', type: 'LINK', title: 'About menu', url: '/acme/about' },
        ],
      },
    })

    const { result } = renderHook(() => useHeaderLinks(), { wrapper })
    const custom = result.current.getCustomLinks()
    const aboutLinks = custom.filter(
      (l) =>
        (l.type === 'LINK' && l.url === '/acme/about') ||
        (l.type === 'system-group' && l.links.some((item) => item.url === '/acme/about')),
    )

    expect(aboutLinks).toHaveLength(0)
    expect(custom.some((l) => l.type === 'LINK' && l.url === '/acme/about')).toBe(false)
  })

  it('keeps custom MORE links before fixed system links', () => {
    const wrapper = makeStoreWrapper({
      community: { slug: 'acme', threads: [] },
      dashboard: {
        headerLinks: [
          {
            id: 'custom:more',
            type: 'GROUP',
            title: '更多',
            links: [{ id: 'community', title: 'Community', url: '/community' }],
          },
        ],
      },
    })

    const { result } = renderHook(() => useHeaderLinks(), { wrapper })
    const more = result.current.getCustomLinks().find((l) => l.type === 'system-group')

    expect(more?.links.map((link) => link.id)).toEqual(['community', 'system:about'])
  })

  it('drops persisted MORE when it only contains system links', () => {
    const wrapper = makeStoreWrapper({
      community: { slug: 'acme', threads: [] },
      dashboard: {
        headerLinks: [
          {
            id: 'custom:more',
            type: 'GROUP',
            title: '更多',
            links: [{ id: 'about', title: 'About', url: '/acme/about' }],
          },
        ],
      },
    })

    const { result } = renderHook(() => useHeaderLinks(), { wrapper })
    const more = result.current.getCustomLinks().find((l) => l.type === 'system-group')

    expect(more).toBeUndefined()
  })
})
