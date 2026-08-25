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

export const Route = createFileRoute('/$community/changelog/_layout/previewer/$id')({
  beforeLoad: ({ location, params, matches }) => {
    requireCanonicalPreviewMask(
      location,
      communityPublicPath(params.community, `/changelog/${params.id}`, matches),
    )
  },
  loader: async ({ context, params }) => {
    const article = await context.queryClient.ensureQueryData(
      communityQueries.changelog(params.community, params.id),
    )
    if (!article) throw notFound()
    return { article }
  },
  component: ChangelogPreview,
})

function ChangelogPreview() {
  const { community, id } = Route.useParams()
  return (
    <Drawer type={TYPE.DRAWER.CHANGELOG_VIEW} resetKey={`${THREAD.CHANGELOG}:${id}`}>
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
    </Drawer>
  )
}
