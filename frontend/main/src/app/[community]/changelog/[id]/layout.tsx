import { getChangelog, getPagedComments } from '~/app/ssr'
import { THREAD } from '~/const/thread'
import ArticleStoreProvider from '~/stores/article/provider'
import CommentsStoreProvider from '~/stores/comments/provider'

export default async function Layout({ children, params }) {
  const params$ = await params
  const { community, id } = params$

  const [changelog, pagedComments] = await Promise.all([
    getChangelog(community, id),
    getPagedComments(community, id, 1, THREAD.CHANGELOG),
  ])

  const articleInitData = { changelog, thread: THREAD.CHANGELOG }
  const commentsInitData = pagedComments
    ? { pagedComments, totalCount: pagedComments.totalCount || 0, initialized: true }
    : { initialized: false }

  return (
    <ArticleStoreProvider initData={articleInitData}>
      <CommentsStoreProvider initData={commentsInitData}>{children}</CommentsStoreProvider>
    </ArticleStoreProvider>
  )
}
