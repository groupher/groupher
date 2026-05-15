'use client'

import useSalon, { cnMerge } from '~/unit/DashboardThread/salon'

export default function DashboardDocLayout({ children }) {
  const s = useSalon()

  return <div className={cnMerge(s.content, 'w-full pl-10')}>{children}</div>
}
