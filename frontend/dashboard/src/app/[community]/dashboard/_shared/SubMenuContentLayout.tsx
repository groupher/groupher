'use client'

import type { ReactNode } from 'react'

import useSalon, { cnMerge } from '~/unit/DashboardThread/salon'

type TProps = {
  children: ReactNode
}

const CONTENT_INLINE_INSET = 'pl-10'

export default function SubMenuContentLayout({ children }: TProps) {
  const s = useSalon()

  return (
    <div
      className={cnMerge(
        s.content,
        'w-full min-w-0 transition-all duration-150 ease-out',
        CONTENT_INLINE_INSET,
      )}
    >
      {children}
    </div>
  )
}
