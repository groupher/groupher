import Layout from '@dash/components/layouts/assets'
import { loadAssets } from '@dash/server/cms'
import { createFileRoute } from '@tanstack/react-router'

import AssetsHub from '~/unit/DashboardThread/AssetsHub'

export const Route = createFileRoute('/$community/assets')({
  staleTime: 60_000,
  loader: ({ params }) => loadAssets({ data: { community: params.community } }),
  component: AssetsPage,
})

function AssetsPage() {
  const initialData = Route.useLoaderData()

  return (
    <Layout>
      <AssetsHub initialData={initialData} />
    </Layout>
  )
}
