import { filter, find, keys } from 'ramda'
import { useCallback } from 'react'
import { MORE_GROUP } from '~/const/dashboard'
import { groupByKey, sortByIndex } from '~/helper'
import useCommunity from '~/hooks/useCommunity'
import useDashboard from '~/hooks/useDashboard'
import type { THeaderLayout, TLinkItem } from '~/spec'

type TGroupInfo = {
  groupedLinks: Record<string, TLinkItem[]>
  groupKeys: string[]
}

type THeaderLinks = {
  layout: THeaderLayout
  links: TLinkItem[]
  getCustomLinks: () => TLinkItem[]
  getGroupedLinks: () => TGroupInfo
}

export default (): THeaderLinks => {
  const store = useDashboard()
  const viewingCommunity = useCommunity()

  const community = viewingCommunity.slug

  const { headerLinks } = store
  // TODO:
  const isModerator = true

  const getCustomLinks = useCallback(() => {
    const hasExtraAbout = find((link: TLinkItem) => link.title === '关于', headerLinks)

    const aboutLink = !hasExtraAbout
      ? {
          index: 999,
          title: '关于',
          group: MORE_GROUP,
          link: `/${community}/about`,
        }
      : { title: '', index: 0 }

    const dashboardLink = {
      index: 1000,
      title: '控制台',
      group: MORE_GROUP,
      link: `/${community}/dashboard`,
    }

    const retLinks = isModerator ? [...headerLinks, aboutLink, dashboardLink] : headerLinks

    return filter((item) => item.title !== '', retLinks)
  }, [headerLinks, community])

  const getGroupedLinks = useCallback(() => {
    const links = getCustomLinks()
    // @ts-expect-error
    const groupedLinks = groupByKey(sortByIndex(links, 'groupIndex'), 'group') as Record<
      string,
      TLinkItem[]
    >
    const groupKeys = keys(groupedLinks)

    return {
      groupedLinks,
      groupKeys,
    }
  }, [getCustomLinks])

  return {
    layout: store.headerLayout,
    // @ts-expect-error
    links: headerLinks,
    // @ts-expect-error
    getCustomLinks,
    getGroupedLinks,
  }
}
