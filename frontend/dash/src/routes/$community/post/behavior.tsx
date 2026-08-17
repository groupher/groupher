import Layout from '@dash/components/layouts/post.behavior'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$community/post/behavior')({
  component: PostBehaviorPage,
})

function PostBehaviorPage() {
  return (
    <Layout>
      <h2>Behavior</h2>
    </Layout>
  )
}
