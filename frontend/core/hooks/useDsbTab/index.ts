'use client'

import { usePathname } from 'next/navigation'

import { DSB_ROUTE } from '~/const/route'

export type TDsbTabState = {
  mainTab: string
  subTab: string | null
}

export default function useDsbTab(): TDsbTabState {
  const pathname = usePathname()

  // /xxx/dashboard/<mainTab>/<subTab>
  const segments = pathname.split('/').filter(Boolean)

  const dashboardIdx = segments.indexOf('dashboard')

  if (dashboardIdx === -1) {
    return {
      mainTab: DSB_ROUTE.OVERVIEW,
      subTab: null,
    }
  }

  const mainTab = segments[dashboardIdx + 1] ?? DSB_ROUTE.OVERVIEW
  const subTab = segments[dashboardIdx + 2] ?? null

  return { mainTab, subTab }
}
