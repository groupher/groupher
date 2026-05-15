'use client'

import type { ReactNode } from 'react'

import useSalon, { cnMerge } from '~/unit/DashboardThread/salon'

export default function DashboardDocLayout({ children }: { children: ReactNode }) {
  const s = useSalon()

  return <div className={cnMerge(s.content, 'w-full pl-10')}>{children}</div>
}
