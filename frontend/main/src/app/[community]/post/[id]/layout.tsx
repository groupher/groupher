import { THREAD } from '~/const/thread'
import { getPagedComments, getPost } from '~/app/ssr'
import ArticleStoreProvider from '~/stores/article/provider'
import CommentsStoreProvider from '~/stores/comments/provider'

// app/post/layout.tsx
export default async function Layout({ children, params }) {
  const params$ = await params
  const { community, id } = params$

  const [post, pagedComments] = await Promise.all([
    getPost(community, id),
    getPagedComments(community, id),
  ])
  // const tags = await getTags(params$.community, THREAD.POST)
  // console.log('## got single post: ', post)
  // console.log('## got tags: ', tags)

  const articleInitData = { post, thread: THREAD.POST }
  const commentsInitData = pagedComments
    ? { pagedComments, totalCount: pagedComments.totalCount || 0, initialized: true }
    : { initialized: false }

  return (
    <ArticleStoreProvider initData={articleInitData}>
      <CommentsStoreProvider initData={commentsInitData}>{children}</CommentsStoreProvider>
    </ArticleStoreProvider>
  )
}
