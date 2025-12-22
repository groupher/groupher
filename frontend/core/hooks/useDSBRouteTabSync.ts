'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import useDashboard from '~/hooks/useDashboard'

type TProps<T extends string> = {
  tab: string
  defaultTab: T

  pathValidator: (value: string) => value is T

  /**
   * dashboard route segment index（0-based）
   */
  segmentIndex?: number
}

const getDashboardRouteSegment = (pathname: string, index: number) =>
  pathname.split('/').filter(Boolean)[index]

export default function useDashboardRouteTabSync<T extends string>({
  tab,
  defaultTab,
  pathValidator,
  segmentIndex = 3,
}: TProps<T>) {
  const pathname = usePathname()
  const dashboard = useDashboard()

  useEffect(() => {
    const segment = getDashboardRouteSegment(pathname, segmentIndex)
    const value = segment ?? defaultTab

    if (!pathValidator(value)) {
      return
    }

    dashboard.commit({ [tab]: value } as Record<string, T>)
  }, [pathname, tab, defaultTab, pathValidator, segmentIndex, dashboard])
}
