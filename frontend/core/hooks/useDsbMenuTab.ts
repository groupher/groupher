'use client'

import { useSelectedLayoutSegments } from 'next/navigation'
import { DSB_ROUTE } from '~/const/route'

export default function useDashboardPart(): string {
  const segments = useSelectedLayoutSegments()

  // 在 /dashboard/layout.tsx 内：
  // segments[0] = <part>
  const part = segments[0]

  return part ?? DSB_ROUTE.OVERVIEW
}
