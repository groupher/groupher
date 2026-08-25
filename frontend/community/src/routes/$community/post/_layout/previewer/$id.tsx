import { communityQueries } from '@community/query/queries'
import { communityPublicPath } from '@community/server/public-path'
import { requireCanonicalPreviewMask } from '@community/utils/preview-route'
import { createFileRoute, notFound } from '@tanstack/react-router'

import { THREAD } from '~/const/thread'
import TYPE from '~/const/type'
import ArticleQueryProvider from '~/query/ArticleQueryProvider'
import CommentsStoreProvider from '~/stores/comments/provider'
import Drawer from '~/ui/@Drawer'
import ArticleViewer from '~/unit/ArticleView'

export const Route = createFileRoute('/$community/post/_layout/previewer/$id')({
  beforeLoad: ({ location, params, matches }) => {
    requireCanonicalPreviewMask(
      location,
      communityPublicPath(params.community, `/post/${params.id}`, matches),
    )
  },
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
  component: PostPreview,
})

function PostPreview() {
  const { community, id } = Route.useParams()
  return (
    <Drawer type={TYPE.DRAWER.POST_VIEW} resetKey={`${THREAD.POST}:${id}`}>
      <ArticleQueryProvider community={community} innerId={id} thread={THREAD.POST}>
        <CommentsStoreProvider>
          <ArticleViewer
            community={community}
            innerId={Number(id)}
            thread={THREAD.POST}
            isFullView
          />
        </CommentsStoreProvider>
      </ArticleQueryProvider>
    </Drawer>
  )
}
