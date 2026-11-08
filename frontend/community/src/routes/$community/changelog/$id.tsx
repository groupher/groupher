import RestrictedCommentFromHash from '@community/components/RestrictedCommentFromHash'
import RestrictedResource from '@community/components/RestrictedResource'
import { prefetchComments } from '@community/query/commentSurface'
import { communityQueries } from '@community/query/queries'
import { loadResourceWithStatus } from '@community/query/restrictedResource'
import { communityPublicPath } from '@community/server/public-path'
import { createFileRoute, notFound } from '@tanstack/react-router'

import { THREAD } from '~/const/thread'
import ArticleQueryProvider from '~/query/ArticleQueryProvider'
import CommentsStoreProvider from '~/stores/comments/provider'
import ArticleViewer from '~/unit/ArticleView'

export const Route = createFileRoute('/$community/changelog/$id')({
  loader: async ({ context, params, parentMatchPromise, location }) => {
    await parentMatchPromise
    const { resource: article, restricted } = await loadResourceWithStatus(
      () =>
        context.queryClient.fetchQuery({
          ...communityQueries.changelog(params.community, params.id),
          staleTime: 0,
        }),
      params.community,
      { type: 'CHANGELOG', articleInnerId: params.id },
    )
    if (restricted) return { article: null, restricted }
    if (!article) throw notFound()
    await prefetchComments(
      context.queryClient,
      params.community,
      THREAD.CHANGELOG,
      params.id,
      location.searchStr,
    )
    await context.queryClient.ensureQueryData(
      communityQueries.stat(context.queryClient, params.community, THREAD.CHANGELOG, params.id),
    )
    return { article, restricted: null }
  },
  head: ({ loaderData, params, matches }) => ({
    meta:
      loaderData?.article?.title || loaderData?.restricted?.title
        ? [{ title: loaderData.article?.title || loaderData.restricted?.title || '' }]
        : [],
    links: [
      {
        rel: 'canonical',
        href: communityPublicPath(params.community, `/changelog/${params.id}`, matches),
      },
    ],
  }),
  component: ChangelogDetail,
})

function ChangelogDetail() {
  const { restricted } = Route.useLoaderData()
  const { community, id } = Route.useParams()
  if (restricted) {
    return (
      <>
        <RestrictedResource node={restricted} />
        <RestrictedCommentFromHash community={community} articleId={id} />
      </>
    )
  }
  return (
    <ArticleQueryProvider community={community} innerId={id} thread={THREAD.CHANGELOG}>
      <CommentsStoreProvider>
        <ArticleViewer
          community={community}
          innerId={Number(id)}
          thread={THREAD.CHANGELOG}
          isFullView
        />
      </CommentsStoreProvider>
    </ArticleQueryProvider>
  )
}
