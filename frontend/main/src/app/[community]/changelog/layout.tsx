import { THREAD } from '~/const/thread'
import { getPagedChangelogs, getTags } from '~/providers/ssr'
import ArticleListStoreProvider from '~/stores/articleList/provider'

export default async ({ children, params }) => {
  const params$ = await params

  const pagedChangelogs = await getPagedChangelogs(params$.community)
  const tags = await getTags(params$.community, THREAD.CHANGELOG)

  const initData = { pagedChangelogs, tags, thread: THREAD.CHANGELOG }

  return <ArticleListStoreProvider initData={initData}>{children}</ArticleListStoreProvider>
}
