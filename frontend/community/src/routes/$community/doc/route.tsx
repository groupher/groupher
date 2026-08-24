import { docTreeClientQuery } from '@community/query/queries'
import { Outlet, createFileRoute } from '@tanstack/react-router'

import ArticleStoreProvider from '~/stores/article/provider'

export const Route = createFileRoute('/$community/doc')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(docTreeClientQuery(params.community)),
  component: DocLayout,
})

function DocLayout() {
  return (
    <ArticleStoreProvider initData={{ isFAQArticleLayout: false }}>
      <Outlet />
    </ArticleStoreProvider>
  )
}
