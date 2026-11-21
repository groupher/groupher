import Layout from '@dash/components/layouts/changelog.trash'
import { loadTrash } from '@dash/server/cms'
import { createFileRoute } from '@tanstack/react-router'

import { THREAD } from '~/const/thread'
import CommunityPostTrash from '~/unit/DsbThread/CMS/Trash'

export const Route = createFileRoute('/$community/changelog/trash')({
  staleTime: 60_000,
  loader: ({ params }) =>
    loadTrash({ data: { community: params.community, thread: THREAD.CHANGELOG } }),
  component: TrashPage,
})

function TrashPage() {
  const initialData = Route.useLoaderData()

  return (
    <Layout>
      <CommunityPostTrash initialData={initialData} thread={THREAD.CHANGELOG} />
    </Layout>
  )
}
