import { getGroupedKanbanPosts } from '~/app/ssr'
import { THREAD } from '~/const/thread'
import ArticleListStoreProvider from '~/stores/articleList/provider'

import KanbanThread from '~/unit/KanbanThread'

export default async function CommunityKanbanPage({ params }) {
  const params$ = await params
  const groupedKanbanPosts = await getGroupedKanbanPosts(params$.community)

  const initData = {
    backlog: groupedKanbanPosts?.backlog,
    todo: groupedKanbanPosts?.todo,
    wip: groupedKanbanPosts?.wip,
    done: groupedKanbanPosts?.done,
    rejected: groupedKanbanPosts?.rejected,
    thread: THREAD.KANBAN,
  }

  return (
    <ArticleListStoreProvider initData={initData}>
      <KanbanThread />
    </ArticleListStoreProvider>
  )
}
