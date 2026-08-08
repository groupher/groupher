import Layout from '@dash/components/layouts/post.content'
import { loadPagedPosts } from '@dash/server/cms'
import { createFileRoute } from '@tanstack/react-router'

import ArticleListStoreProvider from '~/stores/articleList/provider'
import Posts from '~/unit/DashboardThread/CMS/Posts'

export const Route = createFileRoute('/$community/dash/post/content')({
  staleTime: 60_000,
  loader: ({ params }) => loadPagedPosts({ data: { community: params.community } }),
  component: PostContentPage,
})

function PostContentPage() {
  const pagedPosts = Route.useLoaderData()

  return (
    <ArticleListStoreProvider initData={{ pagedPosts: pagedPosts || undefined }}>
      <Layout>
        <Posts />
      </Layout>
    </ArticleListStoreProvider>
  )
}
