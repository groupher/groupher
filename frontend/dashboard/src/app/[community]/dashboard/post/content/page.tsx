'use client'

import ArticleListStoreProvider from '~/stores/articleList/provider'
import Posts from '~/unit/DashboardThread/CMS/Posts'

export default function DashboardPostContentPage() {
  return (
    <ArticleListStoreProvider>
      <Posts />
    </ArticleListStoreProvider>
  )
}
