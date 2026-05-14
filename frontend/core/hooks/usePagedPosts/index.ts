import { useSearchParams } from 'next/navigation'

import { getPagedArticlesParams } from '~/lib/pagedArticlesFilter'
import type { TPagedPosts, TResState, TTagGroup } from '~/spec'
import useArticleList from '~/stores/articleList/hooks'
import useCommunity from '~/stores/community/hooks'

type TUpdate = {
  pagedPosts: TPagedPosts
  tagGroups: TTagGroup[]
}

type TRes = {
  resState: TResState
  pagedPosts: TPagedPosts
  update: (params: TUpdate) => void
  pagedParams: ReturnType<typeof getPagedArticlesParams>
}

export default function usePagedPosts(): TRes {
  const articleList$ = useArticleList()
  const { slug } = useCommunity()
  const { pagedPosts, resState } = articleList$
  const searchParams = useSearchParams()

  const update = ({ pagedPosts, tagGroups }: TUpdate) => {
    articleList$.commit({ pagedPosts, tagGroups })
  }

  const pagedParams = getPagedArticlesParams(slug, searchParams)

  return {
    resState,
    pagedPosts,
    update,
    pagedParams,
  }
}
