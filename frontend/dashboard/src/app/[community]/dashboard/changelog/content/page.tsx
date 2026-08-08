'use client'

import ArticleListStoreProvider from '~/stores/articleList/provider'
import Changelogs from '~/unit/DashboardThread/CMS/Changelogs'

export default function DashboardChangelogContentPage() {
  return (
    <ArticleListStoreProvider>
      <Changelogs />
    </ArticleListStoreProvider>
  )
}
