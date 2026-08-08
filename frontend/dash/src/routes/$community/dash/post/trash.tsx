import Layout from '@dash/components/layouts/post.trash'
import { loadTrash } from '@dash/server/cms'
import { createFileRoute } from '@tanstack/react-router'

import PostTrash from '~/unit/DashboardThread/CMS/Trash'

export const Route = createFileRoute('/$community/dash/post/trash')({
  staleTime: 60_000,
  loader: ({ params }) => loadTrash({ data: { community: params.community } }),
  component: TrashPage,
})

function TrashPage() {
  const initialData = Route.useLoaderData()

  return (
    <Layout>
      <PostTrash initialData={initialData} />
    </Layout>
  )
}
