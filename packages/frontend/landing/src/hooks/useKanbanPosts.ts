import useSubStore from '~/hooks/useSubStore'
import type { TPagedPosts, TResState } from '~/spec'

type TRes = {
  todo: TPagedPosts
  wip: TPagedPosts
  done: TPagedPosts
  resState: TResState
}

export default (): TRes => {
  const { todo, wip, done, resState } = useSubStore('articles')

  return {
    resState,
    todo,
    wip,
    done,
  }
}
