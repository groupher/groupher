import Layout from '@dash/components/layouts/changelog.analysis'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/dash/changelog/analysis')({
  component: ChangelogAnalysisPage,
})

function ChangelogAnalysisPage() {
  return (
    <Layout>
      <h2>Analysis</h2>
    </Layout>
  )
}
