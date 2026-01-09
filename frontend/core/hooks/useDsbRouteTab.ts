'use client'

/**
 * Dashboard tab helper.
 *
 * Generates tab items (with href) and synchronizes route segment to dashboard tab state.
 * Intended to be used by dashboard layouts where tabs and routing are tightly coupled.
 */

import useCommunity from '~/hooks/useCommunity'
import useDashboard from '~/hooks/useDashboard'
import useSyncDSBRoute2Tab, { isRouteOf } from '~/hooks/useSyncDSBRoute2Tab'
import type { TTabItem } from '~/spec'

type TTabDef = Omit<TTabItem, 'href'> & {
  segment?: string
}

export type TDashboardTabsConfig<TRouteEnum extends Record<string, string>> = {
  /**
   * dashboard store current sub tab
   * e.g. 'thirdPartTab'
   */
  tab: string

  /**
   * for route -> tab validation
   */
  routeEnum: TRouteEnum

  /**
   * dashboard's end segment
   * e.g. 'third-part'
   */
  baseSegment: string

  items: readonly TTabDef[]
}

export default function useDsbRouteTab<TRouteEnum extends Record<string, string>>(
  cfg: TDashboardTabsConfig<TRouteEnum>,
): { items: TTabItem[]; activeTab: string } {
  const { slug: community } = useCommunity()
  const dsb$ = useDashboard()

  // ✅ the first on is default tab
  const defaultTab = cfg.items[0]?.slug

  // 1) route/segment -> store sub tab sync
  useSyncDSBRoute2Tab({
    tab: cfg.tab as any,
    defaultTab,
    validator: isRouteOf(cfg.routeEnum),
  })

  // 2) current active[sub]tab from store
  const activeTab = dsb$[cfg.tab]

  // 3) gen tab items with href
  const base = `/${community}/dashboard/${cfg.baseSegment}`

  const items: TTabItem[] = cfg.items.map((it) => {
    const { segment, slug, ...rest } = it

    const resolvedSegment = segment === undefined ? slug : segment

    const pathname = resolvedSegment ? `/${resolvedSegment}` : ''

    return {
      ...rest,
      slug,
      href: `${base}${pathname}`,
    }
  })

  return { items, activeTab }
}
