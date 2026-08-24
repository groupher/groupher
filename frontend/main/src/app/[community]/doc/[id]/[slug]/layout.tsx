import { notFound } from 'next/navigation'

import { THREAD } from '~/const/thread'
import ArticleQueryProvider from '~/query/ArticleQueryProvider'
import { Q, createQueryClient, dehydrate, HydrationBoundary } from '~/query/server'
import ArticleStoreProvider from '~/stores/article/provider'

export default async function Layout({ children, params }) {
  const params$ = await params
  const { community, id } = params$
  const queryClient = createQueryClient()
  const options = Q.SSR.article.detail(community, THREAD.DOC, id)
  await queryClient.prefetchQuery(options)
  const doc = queryClient.getQueryData(options.queryKey)

  if (!doc) notFound()

  const initData = {
    isFAQArticleLayout: false,
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ArticleStoreProvider initData={initData}>
        <ArticleQueryProvider community={community} innerId={id} thread={THREAD.DOC}>
          {children}
        </ArticleQueryProvider>
      </ArticleStoreProvider>
    </HydrationBoundary>
  )
}
