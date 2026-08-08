import Layout from '@dash/components/layouts/changelog.content'
import { loadPagedChangelogs } from '@dash/server/cms'
import { createFileRoute } from '@tanstack/react-router'

import ArticleListStoreProvider from '~/stores/articleList/provider'
import Changelogs from '~/unit/DashboardThread/CMS/Changelogs'

export const Route = createFileRoute('/$community/dash/changelog/content')({
  staleTime: 60_000,
  loader: ({ params }) => loadPagedChangelogs({ data: { community: params.community } }),
  component: ChangelogContentPage,
})

function ChangelogContentPage() {
  const pagedChangelogs = Route.useLoaderData()

  return (
    <ArticleListStoreProvider initData={{ pagedChangelogs: pagedChangelogs || undefined }}>
      <Layout>
        <Changelogs />
      </Layout>
    </ArticleListStoreProvider>
  )
}
