import { includes, reject } from 'ramda'

import { INIT_KANBAN_BOARDS, normalizeKanbanBoards } from '~/const/dashboard'
import { BUILTIN_ALIAS } from '~/const/name'
import { FIELDS } from '~/constant/dsb-fields'
import { removeEmptyValuesFromObject } from '~/helper'
import { decodeWallpaperSettings } from '~/lib/wallpaperSettingsCodec'
import type { TWallpaperSettingsTransport } from '~/lib/wallpaperSettingsCodec'
import type { TCommunity, TNameAlias, TDsb, TParsedWallpaper } from '~/spec'
import type { TWallpaperThemeState } from '~/stores/wallpaper/spec'

/** Parses wallpaper into the canonical frontend shared representation. */
export const parseWallpaper = (community: TCommunity): TParsedWallpaper => {
  if (!community) return {}

  const { dashboard } = community
  if (!dashboard) return {}
  const { wallpaper, wallpaperSettings } = dashboard
  const decodeTheme = (value: unknown): Partial<TWallpaperThemeState> | undefined => {
    if (!value) return undefined
    const decoded = decodeWallpaperSettings(value as TWallpaperSettingsTransport)
    return decoded.type === 'none' ? { type: decoded.type } : decoded
  }

  return {
    light: decodeTheme(wallpaperSettings?.light),
    dark: decodeTheme(wallpaperSettings?.dark),
    wallpaper: wallpaper ?? null,
    initWallpaper: {
      light: decodeTheme(wallpaperSettings?.light),
      dark: decodeTheme(wallpaperSettings?.dark),
    },
  }
}

const parseDashboardAlias = (nameAlias: TNameAlias[]): TNameAlias[] => {
  const changedAliasKeys = nameAlias.map((item) => item.original)
  const unChangedAlias = reject(
    (item: TNameAlias) => includes(item.original, changedAliasKeys),
    BUILTIN_ALIAS,
  )

  return reject((item: TNameAlias) => item.slug === '', [...nameAlias, ...unChangedAlias])
}

/** Parses dashboard into the canonical frontend shared representation. */
export const parseDashboard = (community: TCommunity): TDsb => {
  if (!community) {
    const defaultFields = {
      ...FIELDS,
      pagiRevision: 0,
    }
    return defaultFields
  }

  const { dashboard } = community

  if (!dashboard || Object.keys(dashboard).length === 0) {
    const defaultFields = {
      ...FIELDS,
      pagiRevision: 0,
    }
    return defaultFields
  }

  const {
    enable,
    nameAlias,
    socialLinks,
    docFaq,
    seo,
    layout,
    baseInfo,
    headerLinks,
    footerLinks,
    footerOnelineLinks,
    mediaReports,
    thirdPartyAnalytics,
    enabledThirdPartyAnalytics,
    contentShadow,
    pagiMode,
    pagiMobileMode,
    pagiRevision,
  } = dashboard
  const fieldsObj = removeEmptyValuesFromObject({
    enable,
    nameAlias: parseDashboardAlias([...(nameAlias ?? [])]),
    socialLinks,
    docFaq,
    ...baseInfo,
    ...seo,
    ...layout,
    headerLinks,
    footerLinks,
    footerOnelineLinks,
    mediaReports: (mediaReports || []).map((item, index) => ({
      ...item,
      editUrl: item.url,
      index: item.index ?? index,
    })),
    thirdPartyAnalytics,
    enabledThirdPartyAnalytics,
    contentShadow: contentShadow as boolean | undefined,
    pagiMode: pagiMode ?? 'PAGE',
    pagiMobileMode: pagiMobileMode ?? 'INFINITE_SCROLL',
    pagiRevision: pagiRevision ?? 0,
  }) as Partial<TDsb>

  if (layout?.kanbanBoards?.length) {
    fieldsObj.kanbanBoards = normalizeKanbanBoards(layout.kanbanBoards)
  } else if (!fieldsObj.kanbanBoards?.length) {
    fieldsObj.kanbanBoards = INIT_KANBAN_BOARDS
  }

  if (Object.keys(fieldsObj).length === 0) {
    const defaultFields = {
      ...FIELDS,
      pagiRevision: 0,
    }
    return defaultFields
  }

  return { ...FIELDS, ...fieldsObj }
}
