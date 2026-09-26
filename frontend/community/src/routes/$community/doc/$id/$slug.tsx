import { communityQueries, docTreeClientQuery } from '@community/query/queries'
import { communityPublicPath } from '@community/server/public-path'
import { createFileRoute, notFound } from '@tanstack/react-router'

import { THREAD } from '~/const/thread'
import ArticleQueryProvider from '~/query/ArticleQueryProvider'
import { cacheArticleStatsEntities } from '~/query/articleStats'
import DocThread from '~/unit/DocThread'

export const Route = createFileRoute('/$community/doc/$id/$slug')({
  loader: async ({ context, params }) => {
    const [, doc] = await Promise.all([
      context.queryClient.ensureQueryData(docTreeClientQuery(params.community)),
      context.queryClient.ensureQueryData(communityQueries.doc(params.community, params.id)),
    ])
    if (!doc) throw notFound()
    const stats = await context.queryClient.ensureQueryData(
      communityQueries.stats(params.community, THREAD.DOC, [params.id]),
    )
    cacheArticleStatsEntities(context.queryClient, stats)
    return { doc }
  },
  head: ({ loaderData, params, matches }) => ({
    meta: loaderData?.doc?.title ? [{ title: loaderData.doc.title }] : [],
    links: [
      {
        rel: 'canonical',
        href: communityPublicPath(params.community, `/doc/${params.id}/${params.slug}`, matches),
      },
    ],
  }),
  component: DocArticle,
})

function DocArticle() {
  const { community, id } = Route.useParams()
  return (
    <ArticleQueryProvider community={community} innerId={id} thread={THREAD.DOC}>
      <DocThread article community={community} innerId={Number(id)} />
    </ArticleQueryProvider>
  )
}
