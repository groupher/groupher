import { COLOR } from '~/const/colors'
import { DEFAULT_ENABLE } from '~/const/dashboard'
import { DASHBOARD_LINK_TYPE } from '~/const/dashboard_link'
import METRIC from '~/const/metric'
import { THEME_PRESET_OPTIONS } from '~/const/theme_preset'
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
      pageBg: 'radial-gradient(circle at 20% 20%, #111, #000)',
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
    const claude = THEME_PRESET_OPTIONS.find((item) => item.value === 'CLAUDE')
    if (!claude) {
      throw new Error('Missing CLAUDE preset in THEME_PRESET_OPTIONS')
    }

    store.editFields({
      themePreset: claude.value,
      themeTokens: { ...claude.overwrite },
      pageBg: claude.overwrite.pageBg,
      pageBgDark: claude.overwrite.pageBgDark,
      pageCustomBg: claude.overwrite.pageCustomBg,
      pageCustomBgDark: claude.overwrite.pageCustomBgDark,
      pageCustomIntensity: claude.overwrite.pageCustomIntensity,
      pageCustomIntensityDark: claude.overwrite.pageCustomIntensityDark,
      textTitle: claude.overwrite.textTitle,
      textDigest: claude.overwrite.textDigest,
    })

    expect(store.themePreset).toBe('CLAUDE')
    expect(store.pageBg).toBe(COLOR.CUSTOM)
    expect(store.pageBgDark).toBe(COLOR.CUSTOM)
    expect(store.pageCustomBg).toBe(claude.overwrite.pageCustomBg)
    expect(store.pageCustomBgDark).toBe(claude.overwrite.pageCustomBgDark)
    expect(store.pageCustomIntensity).toBe(claude.overwrite.pageCustomIntensity)
    expect(store.pageCustomIntensityDark).toBe(claude.overwrite.pageCustomIntensityDark)
    expect(store.themeTokens.primaryColor).toBe(COLOR.CUSTOM)
    expect(store.themeTokens.primaryCustomColor).toBe('#c96442')
    expect(store.themeTokens.primaryCustomColorDark).toBe('#d97757')
    expect(store.themeTokens.accentColor).toBe(COLOR.BLUE)
    expect(store.textTitle).toBe(claude.overwrite.textTitle)
    expect(store.textDigest).toBe(claude.overwrite.textDigest)
    expect(
      store.anyTouched([
        'themePreset',
        'themeTokens',
        'pageBg',
        'pageBgDark',
        'pageCustomBg',
        'pageCustomBgDark',
        'pageCustomIntensity',
        'pageCustomIntensityDark',
        'textTitle',
        'textDigest',
      ]),
    ).toBe(true)

    store.rollbackFields([
      'themePreset',
      'themeTokens',
      'pageBg',
      'pageBgDark',
      'pageCustomBg',
      'pageCustomBgDark',
      'pageCustomIntensity',
      'pageCustomIntensityDark',
      'textTitle',
      'textDigest',
    ])

    expect(store.themePreset).toBe(store.original.themePreset)
    expect(store.pageBg).toBe(store.original.pageBg)
    expect(store.pageBgDark).toBe(store.original.pageBgDark)
    expect(store.pageCustomBg).toBe(store.original.pageCustomBg)
    expect(store.pageCustomBgDark).toBe(store.original.pageCustomBgDark)
    expect(store.pageCustomIntensity).toBe(store.original.pageCustomIntensity)
    expect(store.pageCustomIntensityDark).toBe(store.original.pageCustomIntensityDark)
    expect(store.textTitle).toBe(store.original.textTitle)
    expect(store.textDigest).toBe(store.original.textDigest)
    expect(
      store.anyTouched([
        'themePreset',
        'themeTokens',
        'pageBg',
        'pageBgDark',
        'pageCustomBg',
        'pageCustomBgDark',
        'pageCustomIntensity',
        'pageCustomIntensityDark',
        'textTitle',
        'textDigest',
      ]),
    ).toBe(false)
  })
})
