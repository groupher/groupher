import Layout from '@dash/components/layouts/post.analysis'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/post/analysis')({
  component: PostAnalysisPage,
})

function PostAnalysisPage() {
  return (
    <Layout>
      <h2>Analysis</h2>
    </Layout>
  )
}
