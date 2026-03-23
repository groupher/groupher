import type { TPagedPosts, TResState, TTag } from '~/spec'
import useArticleList from '~/stores/articleList/hooks'

export type TUpdate = {
  pagedPosts: TPagedPosts
  tags: TTag[]
}

type TRes = {
  resState: TResState
  pagedPosts: TPagedPosts
  update: (params: TUpdate) => void
}

export default function usePagedPosts(): TRes {
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
