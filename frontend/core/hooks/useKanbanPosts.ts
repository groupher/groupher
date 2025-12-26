import useArticles from '~/hooks/useArticles'
import type { TPagedPosts, TResState } from '~/spec'

type TRes = {
  todo: TPagedPosts
  wip: TPagedPosts
  done: TPagedPosts
  resState: TResState
}

export default (): TRes => {
  const { todo, wip, done, resState } = useArticles()

  return {
    resState,
    todo,
    wip,
    done,
  }
}
