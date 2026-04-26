import { unstable_noStore as noStore } from 'next/cache'

import { getPagedPosts, getTags } from '~/app/ssr'
import { THREAD } from '~/const/thread'
import { getPagedArticlesParams } from '~/lib/pagedArticlesFilter'
import ArticleListStoreProvider from '~/stores/articleList/provider'
import PostThread from '~/unit/PostThread'

export default async function Page({ params, searchParams }) {
  const params$ = await params
  const searchParams$ = await searchParams
  const filter = getPagedArticlesParams(params$.community, searchParams$)

  if (
    (filter.page || 1) !== 1 ||
    filter.communityTag ||
    filter.cat ||
    filter.state ||
    filter.order
  ) {
    noStore()
  }

  const [pagedPosts, tags] = await Promise.all([
    getPagedPosts(filter),
    getTags(params$.community, THREAD.POST),
  ])

  const initData = {
    pagedPosts: pagedPosts || undefined,
    tags,
    thread: THREAD.POST,
  }

  return (
    <ArticleListStoreProvider initData={initData}>
      <PostThread />
    </ArticleListStoreProvider>
  )
}
