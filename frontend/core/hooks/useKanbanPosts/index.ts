import type { TPagedPosts, TResState } from '~/spec'
import useArticleList from '~/stores/articleList/hooks'

type TRes = {
  backlog: TPagedPosts
  todo: TPagedPosts
  wip: TPagedPosts
  done: TPagedPosts
  rejected: TPagedPosts
  resState: TResState
}

/** Exposes kanban posts state and actions through the shared React hook boundary. */
export default function useKanbanPosts(): TRes {
  const { backlog, todo, wip, done, rejected, resState } = useArticleList()

  return {
    resState,
    backlog,
    todo,
    wip,
    done,
    rejected,
  }
}
