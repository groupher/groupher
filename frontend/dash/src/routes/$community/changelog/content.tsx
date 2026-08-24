import Layout from '@dash/components/layouts/changelog.content'
import { dashQueries } from '@dash/query/queries'
import { createFileRoute } from '@tanstack/react-router'

import Changelogs from '~/unit/DashboardThread/CMS/Changelogs'

export const Route = createFileRoute('/$community/changelog/content')({
  staleTime: 60_000,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(dashQueries.changelogs(params.community)),
  component: ChangelogContentPage,
})

function ChangelogContentPage() {
  return (
    <Layout>
      <Changelogs />
    </Layout>
  )
}
