import { communityQueries } from '@community/query/queries'
import { communityPublicPath } from '@community/server/public-path'
import { Outlet, createFileRoute } from '@tanstack/react-router'

import { THREAD } from '~/const/thread'
import { cacheArticleStatsEntities } from '~/query/articleStats'
import ArticleListStoreProvider from '~/stores/articleList/provider'
import ChangelogThread from '~/unit/ChangelogThread'

export const Route = createFileRoute('/$community/changelog/_layout')({
  head: ({ params, matches }) => ({
    links: [
      { rel: 'canonical', href: communityPublicPath(params.community, '/changelog', matches) },
    ],
  }),
  loader: async ({ context, params }) => {
    const changelogs = await context.queryClient.ensureQueryData(
      communityQueries.changelogs(params.community),
    )
    const stats = await context.queryClient.ensureQueryData(
      communityQueries.articleStats(
        params.community,
        THREAD.CHANGELOG,
        (changelogs.entries || []).map((article) => article.innerId),
      ),
    )
    cacheArticleStatsEntities(context.queryClient, stats)
    return { changelogs }
  },
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
