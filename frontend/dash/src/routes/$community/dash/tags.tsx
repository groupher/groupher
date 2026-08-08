import Layout from '@dash/components/layouts/tags'
import { createFileRoute } from '@tanstack/react-router'

import Tags from '~/unit/DashboardThread/Tags'

export const Route = createFileRoute('/$community/dash/tags')({
  component: TagsPage,
})

function TagsPage() {
  return (
    <Layout>
      <Tags />
    </Layout>
  )
}
