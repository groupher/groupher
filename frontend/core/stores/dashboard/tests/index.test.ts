import { DEFAULT_ENABLE } from '~/const/dashboard'
import { DASHBOARD_LINK_TYPE } from '~/const/dashboard_link'
import METRIC from '~/const/metric'
import { THEME_PRESET } from '~/const/theme_preset'
import { KANBAN_BOARD } from '~/const/thread'
import type { TEnableConf, TLinkDraftItem, TLinkItem, TNameAlias } from '~/spec'
import type { TInit } from '~/stores/dashboard/spec'

import setupStore from '..'

const TITLE_FIELD = 'title'
const DESC_FIELD = 'desc'

describe('stores/dashboard', () => {
  it('commits edge data and keeps actions working', () => {
    const init: TInit = { metric: METRIC.COMMUNITY, now: 123 }
    const store = setupStore(init)

    expect(store.metric).toBe(METRIC.COMMUNITY)
    expect(store.now).toBe(123)
    expect(store.headerLinks).toEqual([])

    const headerLinks: readonly TLinkItem[] = [
      {
        id: 'more',
        type: DASHBOARD_LINK_TYPE.GROUP,
        title: 'More',
        links: [
          { id: 'docs', title: 'Docs', url: '/x/docs' },
          { id: 'about', title: 'About', url: '/x/about' },
        ],
      },
    ]

    const enable: TEnableConf = { ...DEFAULT_ENABLE, changelog: false }
    const nameAlias: readonly TNameAlias[] = [
      { group: 'kanban', slug: 'post', name: 'Ideas' },
      { group: 'kanban', slug: 'changelog', name: 'Updates' },
    ]
    const editingLink: TLinkDraftItem = { index: 9, title: 'X', group: 'MORE', link: '/x' }

    store.commit({
      kanbanBoards: [KANBAN_BOARD.BACKLOG, KANBAN_BOARD.TODO],
      headerLinks,
      footerLinks: [
        {
          id: 'links',
          type: DASHBOARD_LINK_TYPE.GROUP,
          title: 'Links',
          links: [{ id: 'github', title: 'GitHub', url: 'https://x' }],
        },
      ],
      enable,
      nameAlias,
      editingLink,
    })

    expect(store.kanbanBoards).toEqual([KANBAN_BOARD.BACKLOG, KANBAN_BOARD.TODO])
    expect(store.headerLinks).toEqual(headerLinks)
    expect(store.enable.post).toBe(true)
    expect(store.enable.changelog).toBe(false)
    expect(store.nameAlias).toHaveLength(2)

    store.debug()
    expect(store.editingLink).toBeNull()
    expect(store.headerLinks).toEqual([])
  })

  it('normalizes empty kanban boards init to defaults', () => {
    const store = setupStore({ kanbanBoards: [] })

    expect(store.kanbanBoards).toEqual(['TODO', 'WIP', 'DONE'])
    expect(store.original.kanbanBoards).toEqual(['TODO', 'WIP', 'DONE'])
  })

  it('uses init data as original baseline when original is not provided', () => {
    const store = setupStore({ title: 'Loaded title' })

    expect(store.original.title).toBe('Loaded title')

    store.editField(TITLE_FIELD, 'Changed title')
    expect(store.isTouched(TITLE_FIELD)).toBe(true)

    store.rollbackFields([TITLE_FIELD])
    expect(store.title).toBe('Loaded title')
    expect(store.isTouched(TITLE_FIELD)).toBe(false)
  })

  it('tracks edited fields and clears them when values return to original', () => {
    const store = setupStore()

    expect(store.isTouched(TITLE_FIELD)).toBe(false)

    store.editField(TITLE_FIELD, 'New title')
    expect(store.title).toBe('New title')
    expect(store.isTouched(TITLE_FIELD)).toBe(true)
    expect(store.anyTouched([TITLE_FIELD, DESC_FIELD])).toBe(true)

    store.editField(TITLE_FIELD, store.original.title)
    expect(store.title).toBe(store.original.title)
    expect(store.isTouched(TITLE_FIELD)).toBe(false)
    expect(store.anyTouched([TITLE_FIELD, DESC_FIELD])).toBe(false)
  })

  it('keeps commit separate from touched tracking', () => {
    const store = setupStore()

    store.commit({ loading: true, title: 'Committed title' })

    expect(store.loading).toBe(true)
    expect(store.title).toBe('Committed title')
    expect(store.isTouched(TITLE_FIELD)).toBe(false)
  })

  it('marks edited fields as saved and supports rollback', () => {
    const store = setupStore()

    store.editFields({ title: 'Saved title', desc: 'Changed desc' })
    expect(store.anyTouched([TITLE_FIELD, DESC_FIELD])).toBe(true)

    store.markFieldsToOriginal([TITLE_FIELD])
    expect(store.original.title).toBe('Saved title')
    expect(store.isTouched(TITLE_FIELD)).toBe(false)
    expect(store.isTouched(DESC_FIELD)).toBe(true)

    store.rollbackFields([DESC_FIELD])
    expect(store.desc).toBe(store.original.desc)
    expect(store.isTouched(DESC_FIELD)).toBe(false)
  })

  it('tracks appearance preset fields as one editable patch', () => {
    const store = setupStore()
    const claude = {
      value: THEME_PRESET.CLAUDE,
      tokens: {
        pageBg: '#fefaf1',
        pageBgDark: '#1e141b',
        pageBgHue: 48,
        pageBgHueDark: 318,
        pageBgIntensity: 32,
        pageBgIntensityDark: 0,
        primaryColor: '#c96442',
        primaryColorDark: '#d97757',
        accentColor: '#5073c6',
        accentColorDark: '#3a7ec7',
        textTitle: '#2f2a24',
        textTitleDark: '#f4eee7',
        textDigest: '#786f63',
        textDigestDark: '#a9a19a',
        cardColor: '#fffdf8',
        cardColorDark: '#261b22',
        dividerColor: '#e6ded2',
        dividerColorDark: '#3a3035',
        gaussBlur: 100,
        gaussBlurDark: 100,
        glowType: '',
        glowTypeDark: '',
        glowFixed: true,
        glowOpacity: 100,
        glowOpacityDark: 100,
      },
    }

    store.editFields({
      themePreset: claude.value,
      themePresetBase: claude.value,
      themeTokens: { ...claude.tokens },
      themePresets: [claude],
    })

    expect(store.themePreset).toBe(THEME_PRESET.CLAUDE)
    expect(store.themePresetBase).toBe(THEME_PRESET.CLAUDE)
    expect(store.themeTokens.pageBg).toBe(claude.tokens.pageBg)
    expect(store.themeTokens.pageBgDark).toBe(claude.tokens.pageBgDark)
    expect(store.themeTokens.primaryColor).toBe('#c96442')
    expect(store.themeTokens.primaryColorDark).toBe('#d97757')
    expect(store.themeTokens.accentColor).toBe('#5073c6')
    expect(store.themeTokens.accentColorDark).toBe('#3a7ec7')
    expect(store.themePresets[0]?.tokens.primaryColor).toBe('#c96442')
    expect(
      store.anyTouched(['themePreset', 'themePresetBase', 'themeTokens', 'themePresets']),
    ).toBe(true)

    store.rollbackFields(['themePreset', 'themePresetBase', 'themeTokens', 'themePresets'])

    expect(store.themePreset).toBe(store.original.themePreset)
    expect(store.themePresetBase).toBe(store.original.themePresetBase)
    expect(store.themeTokens).toEqual(store.original.themeTokens)
    expect(store.themePresets).toEqual(store.original.themePresets)
    expect(
      store.anyTouched(['themePreset', 'themePresetBase', 'themeTokens', 'themePresets']),
    ).toBe(false)
  })
})
