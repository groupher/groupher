import Layout from '@dash/components/layouts/threads'
import { createFileRoute } from '@tanstack/react-router'

import Threads from '~/unit/DashboardThread/Threads'

export const Route = createFileRoute('/$community/dash/threads')({
  component: ThreadsPage,
})

function ThreadsPage() {
  return (
    <Layout>
      <Threads />
    </Layout>
  )
}
