import { useCallback } from 'react'

import type { THeaderLayout, TLinkItem, TResolvedHeaderLinkItem } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDsb from '~/stores/dsb/hooks'

import { resolveHeaderLinks } from './helper'

type THeaderLinks = {
  layout: THeaderLayout
  links: readonly TLinkItem[]
  getCustomLinks: () => readonly TResolvedHeaderLinkItem[]
}

/**
 * Reads dashboard header config and exposes the resolved navigation contract.
 *
 * Consumers get both the raw persisted links and a lazy resolver so render paths
 * can decide when to include synthetic More-tab entries.
 */
export default function useHeaderLinks(): THeaderLinks {
  const { headerLayout, headerLinks } = useDsb()
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
