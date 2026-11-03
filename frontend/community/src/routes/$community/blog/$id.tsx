import { prefetchComments } from '@community/query/commentSurface'
import { communityQueries } from '@community/query/queries'
import { communityPublicPath } from '@community/server/public-path'
import { createFileRoute, notFound } from '@tanstack/react-router'

import { THREAD } from '~/const/thread'

import BlogDetail from './-BlogDetail'

export const Route = createFileRoute('/$community/blog/$id')({
  loader: async ({ context, params, parentMatchPromise, location }) => {
    await parentMatchPromise
    const [article] = await Promise.all([
      context.queryClient.ensureQueryData(communityQueries.blog(params.community, params.id)),
      prefetchComments(
        context.queryClient,
        params.community,
        THREAD.BLOG,
        params.id,
        location.searchStr,
      ),
    ])
    if (!article) throw notFound()
    await context.queryClient.ensureQueryData(
      communityQueries.stat(context.queryClient, params.community, THREAD.BLOG, params.id),
    )
    return { article }
  },
  head: ({ loaderData, params, matches }) => ({
    meta: loaderData?.article?.title ? [{ title: loaderData.article.title }] : [],
    links: [
      {
        rel: 'canonical',
        href: communityPublicPath(params.community, `/blog/${params.id}`, matches),
      },
    ],
  }),
  component: BlogDetail,
})
