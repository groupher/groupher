import ArticlePageBoundary from '@community/components/ArticlePageBoundary'
import { loadArticleSurface } from '@community/query/articleSurface'
import { communityPublicPath } from '@community/server/public-path'
import { Outlet, createFileRoute, redirect, useLocation } from '@tanstack/react-router'

import { THREAD } from '~/const/thread'
import URL_PARAM from '~/const/url_param'
import PagedPostsProvider from '~/hooks/usePagedPosts/provider'
import ArticleListStoreProvider from '~/stores/articleList/provider'
import PostThread from '~/unit/PostThread'

export const Route = createFileRoute('/$community/post/_layout')({
  loader: async ({ context, params, location, parentMatchPromise }) => {
    await parentMatchPromise
    const result = await loadArticleSurface(
      context.queryClient,
      params.community,
      'posts',
      location.searchStr,
    )
    if (result.resetPage && new URLSearchParams(location.searchStr).has(URL_PARAM.PAGE)) {
      const search = new URLSearchParams(location.searchStr)
      search.delete(URL_PARAM.PAGE)
      const query = search.toString()
      throw redirect({
        href: query ? `${location.pathname}?${query}` : location.pathname,
        replace: true,
      })
    }
    return result
  },
  head: ({ params, matches }) => ({
    links: [{ rel: 'canonical', href: communityPublicPath(params.community, '/post', matches) }],
  }),
  component: PostListLayout,
})

function PostListLayout() {
  const { community } = Route.useParams()
  const { recovery } = Route.useLoaderData()
  const { searchStr } = useLocation()
  return (
    <ArticleListStoreProvider initData={{ thread: THREAD.POST }}>
      <ArticlePageBoundary
        key={`${community}:posts:${recovery}:${searchStr}`}
        community={community}
        surface='posts'
        recovery={recovery}
      >
        <PagedPostsProvider>
          <PostThread />
          <Outlet />
        </PagedPostsProvider>
      </ArticlePageBoundary>
    </ArticleListStoreProvider>
  )
}
