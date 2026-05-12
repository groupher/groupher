import { DASHBOARD_LINK_TYPE } from '~/const/dashboard_link'
import type { TLinkChild, TLinkDraftItem, TLinkItem } from '~/spec'

export type TDashboardGroupLink = Extract<TLinkItem, { type: 'GROUP' }>
export type TDashboardSingleLink = Extract<TLinkItem, { type: 'LINK' }>

export const makeDashboardLinkId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export const isDashboardGroupLink = (item: TLinkItem): item is TDashboardGroupLink =>
  item.type === DASHBOARD_LINK_TYPE.GROUP

export const isDashboardSingleLink = (item: TLinkItem): item is TDashboardSingleLink =>
  item.type === DASHBOARD_LINK_TYPE.LINK

export const toDraftLink = (
  link: Pick<TLinkChild, 'title' | 'url'>,
  group: string,
  groupIndex: number,
  index: number,
): TLinkDraftItem => ({
  index,
  title: link.title,
  link: link.url,
  group,
  groupIndex,
})

export const makeDashboardLinkChild = (id: string): TLinkChild => ({
  id,
  title: '',
  url: '',
})

export const makeDashboardLinkGroup = (id: string, title: string): TDashboardGroupLink => ({
  id,
  type: DASHBOARD_LINK_TYPE.GROUP,
  title,
  links: [],
})

export const makeDashboardSingleLink = (id: string): TDashboardSingleLink => ({
  id,
  type: DASHBOARD_LINK_TYPE.LINK,
  title: '',
  url: '',
})

const isValidDashboardLinkChild = (link: TLinkChild): boolean =>
  !!link &&
  typeof link === 'object' &&
  typeof link.id === 'string' &&
  link.id.length > 0 &&
  typeof link.title === 'string' &&
  typeof link.url === 'string'

export const isValidDashboardLink = (item: TLinkItem): boolean => {
  if (!item || typeof item !== 'object') return false
  if (typeof item.id !== 'string' || item.id.length === 0) return false
  if (typeof item.title !== 'string') return false

  if (item.type === DASHBOARD_LINK_TYPE.LINK) {
    return typeof item.url === 'string'
  }

  if (item.type === DASHBOARD_LINK_TYPE.GROUP) {
    return Array.isArray(item.links) && item.links.every(isValidDashboardLinkChild)
  }

  return false
}

export const isValidDashboardLinks = (links: readonly TLinkItem[]): boolean =>
  links.every(isValidDashboardLink)
