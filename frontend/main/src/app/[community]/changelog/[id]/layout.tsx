import { THREAD } from '~/const/thread'
import ArticleQueryProvider from '~/query/ArticleQueryProvider'
import { Q, createQueryClient, dehydrate, HydrationBoundary } from '~/query/server'
import CommentsStoreProvider from '~/stores/comments/provider'

export default async function Layout({ children, params }) {
  const params$ = await params
  const { community, id } = params$

  const queryClient = createQueryClient()
  await Promise.all([
    queryClient.prefetchQuery(Q.SSR.article.detail(community, THREAD.CHANGELOG, id)),
    queryClient.prefetchQuery(Q.SSR.comment.list(community, THREAD.CHANGELOG, id)),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ArticleQueryProvider community={community} innerId={id} thread={THREAD.CHANGELOG}>
        <CommentsStoreProvider>{children}</CommentsStoreProvider>
      </ArticleQueryProvider>
    </HydrationBoundary>
  )
}
