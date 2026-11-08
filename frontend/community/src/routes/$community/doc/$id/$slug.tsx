import RestrictedCommentFromHash from '@community/components/RestrictedCommentFromHash'
import RestrictedResource from '@community/components/RestrictedResource'
import { communityQueries, docTreeClientQuery } from '@community/query/queries'
import { loadResourceWithStatus } from '@community/query/restrictedResource'
import { communityPublicPath } from '@community/server/public-path'
import { createFileRoute, notFound } from '@tanstack/react-router'

import { THREAD } from '~/const/thread'
import ArticleQueryProvider from '~/query/ArticleQueryProvider'
import ArticleFooter from '~/unit/ArticleView/ArticleFooter'
import DocThread from '~/unit/DocThread'

export const Route = createFileRoute('/$community/doc/$id/$slug')({
  loader: async ({ context, params }) => {
    const { resource: doc, restricted } = await loadResourceWithStatus(
      () =>
        context.queryClient.fetchQuery({
          ...communityQueries.doc(params.community, params.id),
          staleTime: 0,
        }),
      params.community,
      { type: 'DOC', articleInnerId: params.id },
    )
    if (restricted) return { doc: null, restricted }
    if (!doc) throw notFound()
    await context.queryClient.ensureQueryData(docTreeClientQuery(params.community))
    await context.queryClient.ensureQueryData(
      communityQueries.stat(context.queryClient, params.community, THREAD.DOC, params.id),
    )
    return { doc, restricted: null }
  },
  head: ({ loaderData, params, matches }) => ({
    meta:
      loaderData?.doc?.title || loaderData?.restricted?.title
        ? [{ title: loaderData.doc?.title || loaderData.restricted?.title || '' }]
        : [],
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
    <ArticleQueryProvider community={community} innerId={id} thread={THREAD.DOC}>
      <>
        <DocThread article community={community} innerId={Number(id)} />
        <ArticleFooter />
      </>
    </ArticleQueryProvider>
  )
}
