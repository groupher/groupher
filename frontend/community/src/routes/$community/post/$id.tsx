import { communityQueries } from '@community/query/queries'
import { createFileRoute, notFound } from '@tanstack/react-router'

import { THREAD } from '~/const/thread'
import ArticleQueryProvider from '~/query/ArticleQueryProvider'
import CommentsStoreProvider from '~/stores/comments/provider'
import ArticleViewer from '~/unit/ArticleView'

export const Route = createFileRoute('/$community/post/$id')({
  loader: async ({ context, params }) => {
    const [post] = await Promise.all([
      context.queryClient.ensureQueryData(communityQueries.post(params.community, params.id)),
      context.queryClient.ensureQueryData(
        communityQueries.comments(params.community, THREAD.POST, params.id),
      ),
    ])
    if (!post) throw notFound()
    return { post }
  },
  head: ({ loaderData, params }) => ({
    meta: loaderData?.post?.title ? [{ title: loaderData.post.title }] : [],
    links: [{ rel: 'canonical', href: `/${params.community}/post/${params.id}` }],
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
