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

export const Route = createFileRoute('/$community/post/$id')({
  loader: async ({ context, params, parentMatchPromise, location }) => {
    await parentMatchPromise
    const { resource: post, restricted } = await loadResourceWithStatus(
      () =>
        context.queryClient.fetchQuery({
          ...communityQueries.post(params.community, params.id),
          staleTime: 0,
        }),
      params.community,
      { type: 'POST', articleInnerId: params.id },
    )
    if (restricted) return { post: null, restricted }
    if (!post) throw notFound()
    await prefetchComments(
      context.queryClient,
      params.community,
      THREAD.POST,
      params.id,
      location.searchStr,
    )
    const postInnerId = Number(post.innerId)
    if (Number.isSafeInteger(postInnerId) && postInnerId > 0) {
      await context.queryClient.ensureQueryData(
        communityQueries.postTicketProgress(params.community, [postInnerId]),
      )
    }
    await context.queryClient.ensureQueryData(
      communityQueries.stat(context.queryClient, params.community, THREAD.POST, params.id),
    )
    return { post, restricted: null }
  },
  head: ({ loaderData, params, matches }) => ({
    meta:
      loaderData?.post?.title || loaderData?.restricted?.title
        ? [{ title: loaderData.post?.title || loaderData.restricted?.title || '' }]
        : [],
    links: [
      {
        rel: 'canonical',
        href: communityPublicPath(params.community, `/post/${params.id}`, matches),
      },
    ],
  }),
  component: PostDetail,
})

function PostDetail() {
  const { community, id } = Route.useParams()
  const { restricted } = Route.useLoaderData()
  if (restricted) {
    return (
      <>
        <RestrictedResource node={restricted} />
        <RestrictedCommentFromHash community={community} articleId={id} />
      </>
    )
  }
  return (
    <ArticleQueryProvider community={community} innerId={id} thread={THREAD.POST}>
      <CommentsStoreProvider>
        <ArticleViewer community={community} innerId={Number(id)} thread={THREAD.POST} isFullView />
      </CommentsStoreProvider>
    </ArticleQueryProvider>
  )
}
