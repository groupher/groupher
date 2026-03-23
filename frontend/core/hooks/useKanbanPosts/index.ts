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
