import { getPagedChangelogs, getTagGroups } from '~/app/ssr'
import { THREAD } from '~/const/thread'
import ArticleListStoreProvider from '~/stores/articleList/provider'
import ChangelogThread from '~/unit/ChangelogThread'

export default async function CommunityChangelogPage({ params }) {
  const params$ = await params

  const [pagedChangelogs, tagGroups] = await Promise.all([
    getPagedChangelogs(params$.community),
    getTagGroups(params$.community, THREAD.CHANGELOG),
  ])

  const initData = {
    pagedChangelogs: pagedChangelogs || undefined,
    tagGroups,
    thread: THREAD.CHANGELOG,
  }

  return (
    <ArticleListStoreProvider initData={initData}>
      <ChangelogThread />
    </ArticleListStoreProvider>
  )
}
