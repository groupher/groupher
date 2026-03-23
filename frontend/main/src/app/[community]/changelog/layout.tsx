import { THREAD } from '~/const/thread'
import { getPagedChangelogs, getTags } from '~/app/ssr'
import ArticleListStoreProvider from '~/stores/articleList/provider'
import ChangelogPreviewAdapter from './ChangelogPreviewAdapter'

export default async ({ children, previewer, params }) => {
  const params$ = await params

  const pagedChangelogs = await getPagedChangelogs(params$.community)
  const tags = await getTags(params$.community, THREAD.CHANGELOG)

  const initData = { pagedChangelogs, tags, thread: THREAD.CHANGELOG }

  return (
    <ArticleListStoreProvider initData={initData}>
      {children}

      <ChangelogPreviewAdapter>{previewer}</ChangelogPreviewAdapter>
    </ArticleListStoreProvider>
  )
}
