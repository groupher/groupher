import { THREAD } from '~/const/thread'
import { Q, createQueryClient, dehydrate, HydrationBoundary } from '~/query/server'
import ArticleListStoreProvider from '~/stores/articleList/provider'
import ChangelogThread from '~/unit/ChangelogThread'

export default async function CommunityChangelogPage({ params }) {
  const params$ = await params

  const queryClient = createQueryClient()
  const filter = { community: params$.community, page: 1, size: 20 }
  await Promise.all([
    queryClient.prefetchQuery(Q.SSR.article.changelogs(filter)),
    queryClient.prefetchQuery(Q.SSR.article.tagGroups(params$.community, THREAD.CHANGELOG)),
  ])

  const initData = { thread: THREAD.CHANGELOG }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ArticleListStoreProvider initData={initData}>
        <ChangelogThread />
      </ArticleListStoreProvider>
    </HydrationBoundary>
  )
}
