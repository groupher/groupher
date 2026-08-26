import { DASHBOARD_LINK_TYPE } from '~/const/dashboard_link'
import type { TFooterOnelineLink, TLinkChild, TLinkItem } from '~/spec'

const isValidFooterLinkChild = (link: TLinkChild): boolean =>
  Boolean(link) &&
  typeof link === 'object' &&
  typeof link.id === 'string' &&
  link.id.length > 0 &&
  typeof link.title === 'string' &&
  typeof link.url === 'string'

/** Validates one grouped or direct footer link before it reaches shared rendering. */
export const isValidFooterLink = (item: TLinkItem): boolean => {
  if (!item || typeof item !== 'object') return false
  if (typeof item.id !== 'string' || item.id.length === 0) return false
  if (typeof item.title !== 'string') return false

  if (item.type === DASHBOARD_LINK_TYPE.LINK) return typeof item.url === 'string'

  if (item.type === DASHBOARD_LINK_TYPE.GROUP) {
    return Array.isArray(item.links) && item.links.every(isValidFooterLinkChild)
  }

  return false
}

/** Validates the complete multi-column footer link collection. */
export const isValidFooterLinks = (links: readonly TLinkItem[]): boolean =>
  links.every(isValidFooterLink)

/** Validates one compact footer link. */
export const isValidFooterOnelineLink = (link: TFooterOnelineLink): boolean =>
  Boolean(link.id) && typeof link.title === 'string' && typeof link.url === 'string'

/** Validates the complete compact footer link collection. */
export const isValidFooterOnelineLinks = (links: readonly TFooterOnelineLink[]): boolean =>
  links.every(isValidFooterOnelineLink)

/** Rejects malformed grouped footer configuration at the shared UI boundary. */
export const normalizeFooterLinks = (links: readonly TLinkItem[]): readonly TLinkItem[] =>
  isValidFooterLinks(links) ? links : []

/** Rejects malformed compact footer configuration at the shared UI boundary. */
export const normalizeFooterOnelineLinks = (
  links: readonly TFooterOnelineLink[],
): readonly TFooterOnelineLink[] => (isValidFooterOnelineLinks(links) ? links : [])
