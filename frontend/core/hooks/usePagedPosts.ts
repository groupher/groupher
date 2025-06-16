import type { TPagedPosts, TResState, TTag } from '~/spec'
import useSubStore from '~/hooks/useSubStore'

export type TUpdate = {
  pagedPosts: TPagedPosts
  tags: TTag[]
}

type TRes = {
  resState: TResState
  pagedPosts: TPagedPosts
  update: (params: TUpdate) => void
}

export default (): TRes => {
  const articlesStore = useSubStore('articles')
  const viewingStore = useSubStore('viewing')
  const { pagedPosts, resState } = articlesStore

  const update = ({ pagedPosts, tags }: TUpdate) => {
    articlesStore.commit({ pagedPosts })
    viewingStore.commit({ tags })
  }

  return {
    resState,
    pagedPosts,
    update,
  }
}
