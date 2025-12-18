// DashboardRouteSync.tsx
'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { DSB_ROUTE } from '~/const/route'
import useDashboard from '~/hooks/useDashboard'
import type { TDsbPath } from '~/spec'

const isDsbPath = (value: string): value is TDsbPath => {
  return Object.values(DSB_ROUTE).includes(value as TDsbPath)
}

export default function DashboardRouteSync() {
  const pathname = usePathname()
  const dashboard = useDashboard()

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    const segment = pathname.split('/').filter(Boolean)[2]
    const section = segment ?? DSB_ROUTE.OVERVIEW

    if (!isDsbPath(section)) {
      console.log('## TODO: add a not found Hint component')
      return
    }

    dashboard.commit({ curTab: section })
  }, [pathname])

  return null
}
