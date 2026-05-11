import { useCallback } from 'react'

import type { THeaderLayout, THeaderLinkItem, TResolvedHeaderLinkItem } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'

import { resolveHeaderLinks } from './helper'

type THeaderLinks = {
  layout: THeaderLayout
  links: readonly THeaderLinkItem[]
  getCustomLinks: () => readonly TResolvedHeaderLinkItem[]
}

export default function useHeaderLinks(): THeaderLinks {
  const { headerLayout, headerLinks } = useDashboard()
  const { slug: community } = useCommunity()

  const getCustomLinks = useCallback(
    () => resolveHeaderLinks(headerLinks, community),
    [headerLinks, community],
  )

  return {
    layout: headerLayout,
    links: headerLinks,
    getCustomLinks,
  }
}
