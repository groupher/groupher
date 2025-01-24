import type { TPagedPosts, TResState } from '~/spec'
import useSubStore from '~/hooks/useSubStore'

type TRes = {
  resState: TResState
  pagedPosts: TPagedPosts
}

export default (): TRes => {
  const { pagedPosts, resState } = useSubStore('articles')

  return {
    resState,
    pagedPosts,
  }
}
