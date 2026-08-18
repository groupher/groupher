import Layout from '@dash/components/layouts/doc.analysis'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/doc/analysis')({
  component: DocAnalysisPage,
})

function DocAnalysisPage() {
  return (
    <Layout>
      <h2>Analysis</h2>
    </Layout>
  )
}
