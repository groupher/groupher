import { prefetchComments } from '@community/query/commentSurface'
import { communityQueries } from '@community/query/queries'
import { communityPublicPath } from '@community/server/public-path'
import { createFileRoute, notFound } from '@tanstack/react-router'

import { THREAD } from '~/const/thread'
import ArticleQueryProvider from '~/query/ArticleQueryProvider'
import CommentsStoreProvider from '~/stores/comments/provider'
import ArticleViewer from '~/unit/ArticleView'

export const Route = createFileRoute('/$community/post/$id')({
  loader: async ({ context, params, parentMatchPromise, location }) => {
    await parentMatchPromise
    const [post] = await Promise.all([
      context.queryClient.ensureQueryData(communityQueries.post(params.community, params.id)),
      prefetchComments(
        context.queryClient,
        params.community,
        THREAD.POST,
        params.id,
        location.searchStr,
      ),
    ])
    if (!post) throw notFound()
    const postInnerId = Number(post.innerId)
    if (Number.isSafeInteger(postInnerId) && postInnerId > 0) {
      await context.queryClient.ensureQueryData(
        communityQueries.postTicketProgress(params.community, [postInnerId]),
      )
    }
    await context.queryClient.ensureQueryData(
      communityQueries.stat(context.queryClient, params.community, THREAD.POST, params.id),
    )
    return { post }
  },
  head: ({ loaderData, params, matches }) => ({
    meta: loaderData?.post?.title ? [{ title: loaderData.post.title }] : [],
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
  return (
    <ArticleQueryProvider community={community} innerId={id} thread={THREAD.POST}>
      <CommentsStoreProvider>
        <ArticleViewer community={community} innerId={Number(id)} thread={THREAD.POST} isFullView />
      </CommentsStoreProvider>
    </ArticleQueryProvider>
  )
}
