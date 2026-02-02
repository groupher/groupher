'use client'

import { useSelectedLayoutSegments } from 'next/navigation'
import useCommunity from '~/hooks/useCommunity'
import type { TTabItem } from '~/spec'

type TTabDef = Omit<TTabItem, 'href'> & { segment?: string }

export type TDsbTabs = {
  segment: string
  items: readonly TTabDef[]
}

export default function useDsbLayoutTabs(cfg: TDsbTabs): {
  items: TTabItem[]
  activeTab: string
} {
  const { slug: community } = useCommunity()
  const segments = useSelectedLayoutSegments()

  // ✅ 在 /dashboard/<part>/layout 内：segments[0] 就是 subpart
  const subpart = segments[0] ?? ''
  const defaultTab = cfg.items[0]?.slug ?? ''

  const activeTab = subpart ? subpart : defaultTab

  if (process.env.NODE_ENV === 'development' && !subpart) {
    console.warn('[useDsbLayoutTabs] index route hit, fallback to defaultTab:', defaultTab)
  }

  const base = `/${community}/dashboard/${cfg.segment}`
  const items: TTabItem[] = cfg.items.map((it) => {
    const { segment, slug, ...rest } = it
    const resolved = segment === undefined ? slug : segment
    const pathname = resolved ? `/${resolved}` : ''

    return { ...rest, slug, href: `${base}${pathname}` }
  })

  return { items, activeTab }
}
