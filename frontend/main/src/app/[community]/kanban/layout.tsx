import { getGroupedKanbanPosts } from '~/app/ssr'
import { THREAD } from '~/const/thread'
import ArticleListStoreProvider from '~/stores/articleList/provider'
import PostPreviewAdapter from '../post/PostPreviewAdapter'

export default async ({ children, previewer, params }) => {
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
      {children}
      <PostPreviewAdapter>{previewer}</PostPreviewAdapter>
    </ArticleListStoreProvider>
  )
}
