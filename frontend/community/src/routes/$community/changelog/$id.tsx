import { communityQueries } from '@community/query/queries'
import { createFileRoute, notFound } from '@tanstack/react-router'

import { THREAD } from '~/const/thread'
import ArticleQueryProvider from '~/query/ArticleQueryProvider'
import CommentsStoreProvider from '~/stores/comments/provider'
import ArticleViewer from '~/unit/ArticleView'

export const Route = createFileRoute('/$community/changelog/$id')({
  loader: async ({ context, params }) => {
    const [article] = await Promise.all([
      context.queryClient.ensureQueryData(communityQueries.changelog(params.community, params.id)),
      context.queryClient.ensureQueryData(
        communityQueries.comments(params.community, THREAD.CHANGELOG, params.id),
      ),
    ])
    if (!article) throw notFound()
    return { article }
  },
  head: ({ loaderData, params }) => ({
    meta: loaderData?.article?.title ? [{ title: loaderData.article.title }] : [],
    links: [{ rel: 'canonical', href: `/${params.community}/changelog/${params.id}` }],
  }),
  component: ChangelogDetail,
})

function ChangelogDetail() {
  const { community, id } = Route.useParams()
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
