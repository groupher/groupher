import { getPagedChangelogs, getTags } from '~/app/ssr'
import { THREAD } from '~/const/thread'
import ArticleListStoreProvider from '~/stores/articleList/provider'
import ChangelogThread from '~/unit/ChangelogThread'

export default async function CommunityChangelogPage({ params }) {
  const params$ = await params

  const [pagedChangelogs, tags] = await Promise.all([
    getPagedChangelogs(params$.community),
    getTags(params$.community, THREAD.CHANGELOG),
  ])

  const initData = { pagedChangelogs: pagedChangelogs || undefined, tags, thread: THREAD.CHANGELOG }

  return (
    <ArticleListStoreProvider initData={initData}>
      <ChangelogThread />
    </ArticleListStoreProvider>
  )
}
