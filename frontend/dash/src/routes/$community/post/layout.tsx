import Layout from '@dash/components/layouts/post.layout'
import { createFileRoute } from '@tanstack/react-router'

import PostLayout from '~/unit/DashboardThread/Appearance/PostLayout'

export const Route = createFileRoute('/$community/post/layout')({
  component: PostLayoutPage,
})

function PostLayoutPage() {
  return (
    <Layout>
      <PostLayout />
    </Layout>
  )
}
