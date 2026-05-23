'use client'

import useSalon, { cnMerge } from '~/unit/DashboardThread/salon'

const DashboardKanbanPage = ({ children }) => {
  const s = useSalon()

  return <div className={cnMerge(s.content, 'w-full pl-10')}>{children}</div>
}

export default DashboardKanbanPage
