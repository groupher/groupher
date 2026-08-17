'use client'

import type { ReactNode } from 'react'

import useDashboardStore from '~/stores/dashboard/hooks'
import useSalon, { cnMerge } from '~/unit/DashboardThread/salon'

type TProps = {
  children: ReactNode
}

const CONTENT_INLINE_INSET = 'pl-10'
const COLLAPSED_CONTENT_INLINE_INSET = 'pl-0'

export default function SubMenuContentLayout({ children }: TProps) {
  const s = useSalon()
  const { submenuCollapsed } = useDashboardStore()

  return (
    <div
      className={cnMerge(
        s.content,
        'w-full min-w-0 transition-all duration-150 ease-out',
        submenuCollapsed ? COLLAPSED_CONTENT_INLINE_INSET : CONTENT_INLINE_INSET,
      )}
    >
      {children}
    </div>
  )
}
