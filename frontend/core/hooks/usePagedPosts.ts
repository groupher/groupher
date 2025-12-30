import useArticleList from '~/hooks/useArticleList'
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
  const articleList$ = useArticleList()
  const { pagedPosts, resState } = articleList$

  const update = ({ pagedPosts, tags }: TUpdate) => {
    articleList$.commit({ pagedPosts, tags })
  }

  return {
    resState,
    pagedPosts,
    update,
  }
}
