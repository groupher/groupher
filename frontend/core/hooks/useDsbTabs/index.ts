'use client'

import { useSelectedLayoutSegments } from 'next/navigation'

import useURLSearchParams from '~/hooks/useURLSearchParams'
import type { TTabItem } from '~/spec'
import useCommunity from '~/stores/community/hooks'

type TTabDef = Omit<TTabItem, 'href'> & { segment?: string }

export type TDsbTabs = {
  segment: string
  items: readonly TTabDef[]
}

export default function useDsbTabs(cfg: TDsbTabs): {
  items: TTabItem[]
  activeTab: string
} {
  const { slug: community } = useCommunity()
  const segments = useSelectedLayoutSegments()
  const querySuffix = useURLSearchParams()

  // In /dashboard/<section>/<tab>, segments[0] is the active tab segment.
  const subpart = segments[0] ?? ''
  const defaultTab = cfg.items[0]?.slug ?? ''

  const activeTab = subpart ? subpart : defaultTab

  if (process.env.NODE_ENV === 'development' && !subpart) {
    console.warn('[useDsbTabs] index route hit, fallback to defaultTab:', defaultTab)
  }

  const base = `/${community}/dashboard/${cfg.segment}`
  const items: TTabItem[] = cfg.items.map((it) => {
    const { segment, slug, ...rest } = it
    const resolved = segment === undefined ? slug : segment
    const pathname = resolved ? `/${resolved}` : ''

    return { ...rest, title: rest.title, slug, href: `${base}${pathname}${querySuffix}` }
  })

  return { items, activeTab }
}
