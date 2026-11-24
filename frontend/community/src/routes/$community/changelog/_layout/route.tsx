import ArticlePageBoundary from '@community/components/ArticlePageBoundary'
import { loadArticleSurface } from '@community/query/articleSurface'
import { communityPublicPath } from '@community/server/public-path'
import { Outlet, createFileRoute, redirect, useLocation } from '@tanstack/react-router'

import { THREAD } from '~/const/thread'
import URL_PARAM from '~/const/url_param'
import PagedChangelogsProvider from '~/hooks/usePagedChangelogs/provider'
import ArticleListStoreProvider from '~/stores/articleList/provider'
import ChangelogThread from '~/unit/ChangelogThread'

export const Route = createFileRoute('/$community/changelog/_layout')({
  loader: async ({ context, params, location, parentMatchPromise }) => {
    await parentMatchPromise
    const result = await loadArticleSurface(
      context.queryClient,
      params.community,
      'changelogs',
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
    links: [
      { rel: 'canonical', href: communityPublicPath(params.community, '/changelog', matches) },
    ],
  }),
  component: ChangelogListLayout,
})

function ChangelogListLayout() {
  const { community } = Route.useParams()
  const { recovery } = Route.useLoaderData()
  const { searchStr } = useLocation()
  return (
    <ArticleListStoreProvider initData={{ thread: THREAD.CHANGELOG }}>
      <ArticlePageBoundary
        key={`${community}:changelogs:${recovery}:${searchStr}`}
        community={community}
        surface='changelogs'
        recovery={recovery}
      >
        <PagedChangelogsProvider>
          <ChangelogThread />
          <Outlet />
        </PagedChangelogsProvider>
      </ArticlePageBoundary>
    </ArticleListStoreProvider>
  )
}
