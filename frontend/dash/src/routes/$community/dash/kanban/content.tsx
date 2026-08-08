import Layout from '@dash/components/layouts/kanban.content'
import { loadKanban } from '@dash/server/cms'
import { createFileRoute } from '@tanstack/react-router'

import Kanban from '~/unit/DashboardThread/CMS/Kanban'

export const Route = createFileRoute('/$community/dash/kanban/content')({
  staleTime: 60_000,
  loader: ({ params }) => loadKanban({ data: { community: params.community } }),
  component: KanbanContentPage,
})

function KanbanContentPage() {
  const initialData = Route.useLoaderData()

  return (
    <Layout>
      <Kanban initialData={initialData} />
    </Layout>
  )
}
