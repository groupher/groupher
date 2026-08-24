import { communityQueries } from '@community/query/queries'
import { Outlet, createFileRoute } from '@tanstack/react-router'

import { THREAD } from '~/const/thread'
import ArticleListStoreProvider from '~/stores/articleList/provider'
import ChangelogThread from '~/unit/ChangelogThread'

export const Route = createFileRoute('/$community/changelog/_layout')({
  head: ({ params }) => ({
    links: [{ rel: 'canonical', href: `/${params.community}/changelog` }],
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(communityQueries.changelogs(params.community)),
  component: ChangelogListLayout,
})

function ChangelogListLayout() {
  return (
    <ArticleListStoreProvider initData={{ thread: THREAD.CHANGELOG }}>
      <ChangelogThread />
      <Outlet />
    </ArticleListStoreProvider>
  )
}
