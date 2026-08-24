import { THREAD } from '~/const/thread'
import { Q, createQueryClient, dehydrate, HydrationBoundary } from '~/query/server'
import ArticleListStoreProvider from '~/stores/articleList/provider'
import PostThread from '~/unit/PostThread'

export default async function Page({ params }) {
  const { community } = await params
  const queryClient = createQueryClient()
  const defaultFilter = { community, page: 1, size: 20 }
  await Promise.all([
    queryClient.prefetchQuery(Q.SSR.article.posts(defaultFilter)),
    queryClient.prefetchQuery(Q.SSR.article.tagGroups(community, THREAD.POST)),
  ])

  const initData = { thread: THREAD.POST }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ArticleListStoreProvider initData={initData}>
        <PostThread />
      </ArticleListStoreProvider>
    </HydrationBoundary>
  )
}
