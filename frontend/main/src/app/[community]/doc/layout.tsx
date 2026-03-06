import { THREAD } from '~/const/thread'
import ArticleStoreProvider from '~/stores/article/provider'

export default async ({ children }) => {
  const initData = {
    thread: THREAD.DOC,
    isArticleLayout: false,
    isFAQArticleLayout: false,
  }

  return <ArticleStoreProvider initData={initData}>{children}</ArticleStoreProvider>
}
