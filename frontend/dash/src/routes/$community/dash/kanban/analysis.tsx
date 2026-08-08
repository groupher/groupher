import Layout from '@dash/components/layouts/kanban.analysis'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/dash/kanban/analysis')({
  component: KanbanAnalysisPage,
})

function KanbanAnalysisPage() {
  return (
    <Layout>
      <h2>Analysis</h2>
    </Layout>
  )
}
