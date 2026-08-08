import { includes, reject } from 'ramda'

import { INIT_KANBAN_BOARDS, normalizeKanbanBoards } from '~/const/dashboard'
import { BUILTIN_ALIAS } from '~/const/name'
import { removeEmptyValuesFromObject } from '~/helper'
import type { TCommunity, TNameAlias, TParseDashboard, TParsedWallpaper } from '~/spec'
import { FIELDS } from '~/stores/dashboard/constant'

export const parseWallpaper = (community: TCommunity): TParsedWallpaper => {
  if (!community) return {}

  const { dashboard } = community
  const { wallpaper } = dashboard

  return {
    ...wallpaper,
    initWallpaper: {
      ...wallpaper,
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

export const parseDashboard = (community: TCommunity): TParseDashboard => {
  if (!community) {
    const defaultFields = { ...FIELDS }
    return { ...defaultFields, original: defaultFields }
  }

  const { dashboard, moderators } = community

  if (!dashboard || Object.keys(dashboard).length === 0) {
    const defaultFields = { ...FIELDS }
    return { ...defaultFields, original: defaultFields }
  }

  const {
    enable,
    nameAlias,
    socialLinks,
    docFaq,
    seo,
    layout,
    rss,
    baseInfo,
    headerLinks,
    footerLinks,
    footerOnelineLinks,
    mediaReports,
    thirdPartyAnalytics,
    enabledThirdPartyAnalytics,
    umamiWebsiteId,
  } = dashboard
  const fieldsObj = removeEmptyValuesFromObject({
    enable,
    nameAlias: parseDashboardAlias([...nameAlias]),
    socialLinks,
    docFaq,
    ...baseInfo,
    ...seo,
    ...layout,
    ...rss,
    headerLinks,
    footerLinks,
    footerOnelineLinks,
    moderators,
    mediaReports,
    thirdPartyAnalytics,
    enabledThirdPartyAnalytics,
    umamiWebsiteId,
  }) as Partial<TParseDashboard>

  if (layout?.kanbanBoards?.length) {
    fieldsObj.kanbanBoards = normalizeKanbanBoards(layout.kanbanBoards)
  } else if (!fieldsObj.kanbanBoards?.length) {
    fieldsObj.kanbanBoards = INIT_KANBAN_BOARDS
  }

  if (Object.keys(fieldsObj).length === 0) {
    const defaultFields = { ...FIELDS }
    return { ...defaultFields, original: defaultFields }
  }

  const mergedFields = { ...FIELDS, ...fieldsObj }
  return { ...mergedFields, original: mergedFields }
}
