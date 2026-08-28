import Layout from '@dash/components/layouts/post.content'
import { dashQueries } from '@dash/query/queries'
import { createFileRoute } from '@tanstack/react-router'

import Posts from '~/unit/DsbThread/CMS/Posts'

export const Route = createFileRoute('/$community/post/content')({
  staleTime: 60_000,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(dashQueries.posts(params.community)),
  component: PostContentPage,
})

function PostContentPage() {
  return (
    <Layout>
      <Posts />
    </Layout>
  )
}
