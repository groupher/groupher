import { THREAD } from '~/const/thread'
import { getPost } from '~/providers/domain'
import ArticleStoreProvider from '~/stores/article/provider'

// app/post/layout.tsx
export default async ({ children, params }) => {
  const params$ = await params
  const { community, id } = params$

  const post = await getPost(community, id)
  // const tags = await getTags(params$.community, THREAD.POST)
  console.log('## got single post: ', post)
  // console.log('## got tags: ', tags)

  const initData = { post, thread: THREAD.POST }

  return <ArticleStoreProvider initData={initData}>{children}</ArticleStoreProvider>
}
