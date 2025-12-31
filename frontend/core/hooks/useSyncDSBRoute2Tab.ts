'use client'

/**
 * Synchronizes a dashboard route segment into dashboard state.
 *
 * This hook listens to pathname changes and updates a specific
 * dashboard tab state when the route segment is valid.
 *
 * Typical usage:
 * - Dashboard layout tabs
 * - Settings sub-sections
 * - SEO / appearance configuration pages
 */
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import useDashboard from '~/hooks/useDashboard'
import { isOneOf } from '~/utils/helper'

type TProps<T extends string> = {
  tab: string
  defaultTab: T

  validator: (value: string) => value is T

  /**
   * dashboard route segment index（0-based）
   */
  segmentIndex?: number
}

/**
 * Creates a type-safe predicate for validating route or tab values
 * defined as an enum-like object.
 *
 * This helper is intended for routing and navigation scenarios,
 * where allowed values are declared as route config objects.
 *
 * @example
 * const isLayoutRoute = isRouteOf(DSB_LAYOUT_ROUTE)
 *
 * if (isLayoutRoute(segment)) {
 *   // segment is now typed as TDsbLayoutRoute
 * }
 */
export const isRouteOf = <const T extends Record<string, string>>(routeEnum: T) => {
  return isOneOf(Object.values(routeEnum))
}

const getDashboardRouteSegment = (pathname: string, index: number) =>
  pathname.split('/').filter(Boolean)[index]

export default function useDashboardRouteTabSync<T extends string>({
  tab,
  defaultTab,
  validator,
  segmentIndex = 3,
}: TProps<T>) {
  const pathname = usePathname()
  const dsb$ = useDashboard()

  useEffect(() => {
    const segment = getDashboardRouteSegment(pathname, segmentIndex)
    const value = segment ?? defaultTab

    if (!validator(value)) {
      return
    }

    dsb$.commit({ [tab]: value } as Record<string, T>)
  }, [pathname, tab, defaultTab, validator, segmentIndex, dsb$])
}
