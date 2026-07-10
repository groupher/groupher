import { notFound } from 'next/navigation'

import { getDoc } from '~/app/ssr'
import { THREAD } from '~/const/thread'
import ArticleStoreProvider from '~/stores/article/provider'

export default async function Layout({ children, params }) {
  const params$ = await params
  const { community, id } = params$
  const doc = await getDoc(community, id)

  if (!doc) notFound()

  const initData = {
    doc,
    thread: THREAD.DOC,
    isArticleLayout: true,
    isFAQArticleLayout: false,
  }

  return <ArticleStoreProvider initData={initData}>{children}</ArticleStoreProvider>
}
