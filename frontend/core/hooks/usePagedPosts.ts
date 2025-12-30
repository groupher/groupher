import useArticleList from '~/hooks/useArticleList'
import useGeneral from '~/hooks/useGeneral'
import type { TPagedPosts, TResState, TTag } from '~/spec'

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
  const articlesStore = useArticleList()
  const viewingStore = useGeneral()
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
