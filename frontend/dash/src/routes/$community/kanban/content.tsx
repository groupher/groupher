import Layout from '@dash/components/layouts/kanban.content'
import { dashQueries } from '@dash/query/queries'
import { createFileRoute } from '@tanstack/react-router'

import Kanban from '~/unit/DsbThread/CMS/Kanban'

export const Route = createFileRoute('/$community/kanban/content')({
  staleTime: 60_000,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(dashQueries.kanban(params.community)),
  component: KanbanContentPage,
})

function KanbanContentPage() {
  return (
    <Layout>
      <Kanban />
    </Layout>
  )
}
