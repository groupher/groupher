import { THREAD } from '~/const/thread'
import { getGroupedKanbanPosts } from '~/providers/ssr'
import ArticleListStoreProvider from '~/stores/articleList/provider'

export default async ({ children, params }) => {
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

  return <ArticleListStoreProvider initData={initData}>{children}</ArticleListStoreProvider>
}
