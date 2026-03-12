import { MORE_GROUP } from '~/const/dashboard'
import { ROUTE } from '~/const/route'
import type { TLinkItem } from '~/spec'

export const getAboutPath = (community: string): string => `/${community}/${ROUTE.ABOUT}`

export const isAboutLink = (link: TLinkItem, community: string): boolean =>
  link.link === getAboutPath(community)

export const hasAboutLinkInMore = (links: readonly TLinkItem[], community: string): boolean =>
  links.some((link) => link.group === MORE_GROUP && isAboutLink(link, community))

export const hasCustomMainLinks = (links: readonly TLinkItem[]): boolean =>
  links.some((link) => link.title !== '' && link.group !== MORE_GROUP)

export const shouldFoldAboutToMore = (links: readonly TLinkItem[], community: string): boolean =>
  hasCustomMainLinks(links) || hasAboutLinkInMore(links, community)
