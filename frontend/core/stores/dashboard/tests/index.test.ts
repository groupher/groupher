import { COLOR } from '~/const/colors'
import { DEFAULT_ENABLE } from '~/const/dashboard'
import METRIC from '~/const/metric'

import setupStore from '..'

import type { TEnableConf, TLinkItem, TNameAlias, TTag } from '~/spec'
import type { TInit } from '~/stores/dashboard/spec'

describe('stores/dashboard', () => {
  it('commits edge data and keeps actions working', () => {
    const init: TInit = { metric: METRIC.COMMUNITY, now: 123 }
    const store = setupStore(init)

    expect(store.metric).toBe(METRIC.COMMUNITY)
    expect(store.now).toBe(123)
    expect(store.headerLinks).toEqual([])

    const headerLinks: readonly TLinkItem[] = [
      { index: 2, title: 'Docs', group: 'MORE', link: '/x/docs', groupIndex: 2 },
      { index: 1, title: 'About', group: 'MORE', link: '/x/about', groupIndex: 1 },
    ]

    const enable: TEnableConf = { ...DEFAULT_ENABLE, changelog: false }
    const nameAlias: readonly TNameAlias[] = [
      { group: 'kanban', slug: 'post', name: 'Ideas' },
      { group: 'kanban', slug: 'changelog', name: 'Updates' },
    ]
    const tags: readonly TTag[] = [
      { id: 't1', title: 'Edge', color: COLOR.ORANGE },
      { id: 't2', title: 'Case', color: COLOR.BLACK },
    ]
    const editingLink: TLinkItem = { index: 9, title: 'X', group: 'MORE', link: '/x' }

    store.commit({
      primaryColor: COLOR.ORANGE,
      subPrimaryColor: COLOR.RED,
      pageBg: 'radial-gradient(circle at 20% 20%, #111, #000)',
      headerLinks,
      footerLinks: [{ index: 1, title: 'GitHub', group: 'LINKS', link: 'https://x' }],
      enable,
      nameAlias,
      tags,
      editingLink,
    })

    expect(store.primaryColor).toBe(COLOR.ORANGE)
    expect(store.subPrimaryColor).toBe(COLOR.RED)
    expect(store.headerLinks).toEqual(headerLinks)
    expect(store.enable.post).toBe(true)
    expect(store.enable.changelog).toBe(false)
    expect(store.nameAlias).toHaveLength(2)
    expect(store.tags).toHaveLength(2)

    store.debug()
    expect(store.editingLink).toBeNull()
    expect(store.headerLinks).toEqual([])
  })
})
