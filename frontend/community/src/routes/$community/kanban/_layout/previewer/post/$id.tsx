import { communityQueries } from '@community/query/queries'
import { requireCanonicalPreviewMask } from '@community/utils/preview-route'
import { createFileRoute, notFound } from '@tanstack/react-router'

import { THREAD } from '~/const/thread'
import TYPE from '~/const/type'
import ArticleQueryProvider from '~/query/ArticleQueryProvider'
import CommentsStoreProvider from '~/stores/comments/provider'
import Drawer from '~/ui/@Drawer'
import ArticleViewer from '~/unit/ArticleView'

export const Route = createFileRoute('/$community/kanban/_layout/previewer/post/$id')({
  beforeLoad: ({ location, params }) => {
    requireCanonicalPreviewMask(location, `/${params.community}/post/${params.id}`)
  },
  loader: async ({ context, params }) => {
    const post = await context.queryClient.ensureQueryData(
      communityQueries.post(params.community, params.id),
    )
    if (!post) throw notFound()
    return { post }
  },
  component: KanbanPostPreview,
})

function KanbanPostPreview() {
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
