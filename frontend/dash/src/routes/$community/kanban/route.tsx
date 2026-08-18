import Layout from '@dash/components/layouts/kanban'
import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/kanban')({
  component: KanbanPage,
})

function KanbanPage() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}
