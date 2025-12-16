import { THREAD } from '~/const/thread'
import { getPagedPosts, getTags } from '~/providers/domain'
import ArticlesStoreProvider from '~/stores/articles/provider'

// app/post/layout.tsx
export default async ({ children, previewer, params }) => {
  const params$ = await params

  const pagedPosts = await getPagedPosts(params$.community)
  const tags = await getTags(params$.community, THREAD.POST)
  console.log('## got posts: ', pagedPosts)
  // console.log('## got tags: ', tags)

  return (
    <ArticlesStoreProvider
      initData={{
        pagedPosts,
        tags: [...tags],
      }}
    >
      <div>
        {children}

        {previewer && <>{previewer}</>}
      </div>
    </ArticlesStoreProvider>
  )
}
