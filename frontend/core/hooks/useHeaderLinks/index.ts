import { filter } from 'ramda'
import { useCallback } from 'react'
import { MORE_GROUP } from '~/const/dashboard'
import { groupByKey, sortByGroupIndex } from '~/helper'
import type { THeaderLayout, TLinkItem } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'
import { getAboutPath, hasAboutLinkInMore, shouldFoldAboutToMore } from './helper'

type TGroupInfo = {
  groupedLinks: Record<string, TLinkItem[]>
  groupKeys: string[]
}

type THeaderLinks = {
  layout: THeaderLayout
  links: readonly TLinkItem[]
  getCustomLinks: () => readonly TLinkItem[]
  getGroupedLinks: () => TGroupInfo
}

export default function useHeaderLinks(): THeaderLinks {
  const { headerLayout, headerLinks } = useDashboard()
  const { slug: community } = useCommunity()

  const isModerator = true

  const getCustomLinks = useCallback(() => {
    const shouldFoldAbout = shouldFoldAboutToMore(headerLinks, community)
    const hasMoreAbout = hasAboutLinkInMore(headerLinks, community)

    const aboutLink =
      shouldFoldAbout && !hasMoreAbout
        ? {
            index: 999,
            title: '关于',
            group: MORE_GROUP,
            link: getAboutPath(community),
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
    const groupedLinks = groupByKey(
      sortByGroupIndex(links as (TLinkItem & { groupIndex: number })[]),
      'group',
    )

    const groupKeys = Object.keys(groupedLinks) as string[]

    return {
      groupedLinks,
      groupKeys,
    }
  }, [getCustomLinks])

  return {
    layout: headerLayout,
    links: headerLinks,
    getCustomLinks,
    getGroupedLinks,
  }
}
