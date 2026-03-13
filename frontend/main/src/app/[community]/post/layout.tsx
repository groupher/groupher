import { THREAD } from '~/const/thread'
import { getPagedPosts, getTags } from '~/providers/ssr'
import ArticleListStoreProvider from '~/stores/articleList/provider'
import PostPreviewAdapter from './PostPreviewAdapter'

// app/post/layout.tsx
export default async ({ children, previewer, params }) => {
  const params$ = await params

  const pagedPosts = await getPagedPosts(params$.community)
  const tags = await getTags(params$.community, THREAD.POST)
  // console.log('## got posts: ', pagedPosts)
  // console.log('## got tags: ', tags)

  const initData = { pagedPosts, tags, thread: THREAD.POST }

  return (
    <ArticleListStoreProvider initData={initData}>
      {children}

      <PostPreviewAdapter>{previewer}</PostPreviewAdapter>
    </ArticleListStoreProvider>
  )
}
