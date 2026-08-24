import ArticleStoreProvider from '~/stores/article/provider'

export default async ({ children }) => {
  const initData = {
    isFAQArticleLayout: false,
  }

  return <ArticleStoreProvider initData={initData}>{children}</ArticleStoreProvider>
}
