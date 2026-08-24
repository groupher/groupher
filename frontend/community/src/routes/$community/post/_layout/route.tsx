import { communityQueries } from '@community/query/queries'
import { Outlet, createFileRoute } from '@tanstack/react-router'

import { THREAD } from '~/const/thread'
import ArticleListStoreProvider from '~/stores/articleList/provider'
import PostThread from '~/unit/PostThread'

export const Route = createFileRoute('/$community/post/_layout')({
  head: ({ params }) => ({
    links: [{ rel: 'canonical', href: `/${params.community}/post` }],
  }),
  loader: async ({ context, params }) => {
    const posts = await context.queryClient.ensureQueryData(
      communityQueries.posts(params.community),
    )
    return { posts }
  },
  component: PostListLayout,
})

function PostListLayout() {
  return (
    <ArticleListStoreProvider initData={{ thread: THREAD.POST }}>
      <PostThread />
      <Outlet />
    </ArticleListStoreProvider>
  )
}
