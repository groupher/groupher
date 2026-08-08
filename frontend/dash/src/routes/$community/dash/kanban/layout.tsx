import Layout from '@dash/components/layouts/kanban.layout'
import { createFileRoute } from '@tanstack/react-router'

import KanbanLayout from '~/unit/DashboardThread/Appearance/KanbanLayout'

export const Route = createFileRoute('/$community/dash/kanban/layout')({
  component: KanbanLayoutPage,
})

function KanbanLayoutPage() {
  return (
    <Layout>
      <KanbanLayout />
    </Layout>
  )
}
