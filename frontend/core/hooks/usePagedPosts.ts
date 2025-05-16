import type { TPagedPosts, TResState } from '~/spec'
import useSubStore from '~/hooks/useSubStore'

type TRes = {
  resState: TResState
  pagedPosts: TPagedPosts
  update: (pagedPosts: TPagedPosts) => void
}

export default (): TRes => {
  const articlesStore = useSubStore('articles')
  const { pagedPosts, resState } = articlesStore

  const update = (pagedPosts: TPagedPosts) => {
    articlesStore.commit({ pagedPosts })
  }

  return {
    resState,
    pagedPosts,
    update,
  }
}
