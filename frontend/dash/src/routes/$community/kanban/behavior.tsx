import Layout from '@dash/components/layouts/kanban.behavior'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/kanban/behavior')({
  component: KanbanBehaviorPage,
})

function KanbanBehaviorPage() {
  return (
    <Layout>
      <h2>Behavior</h2>
    </Layout>
  )
}
