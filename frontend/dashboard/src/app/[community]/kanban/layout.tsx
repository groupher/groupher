'use client'

import type { ReactNode } from 'react'

import SubMenuContentLayout from '../_shared/SubMenuContentLayout'

const DashboardKanbanPage = ({ children }: { children: ReactNode }) => {
  return <SubMenuContentLayout>{children}</SubMenuContentLayout>
}

export default DashboardKanbanPage
