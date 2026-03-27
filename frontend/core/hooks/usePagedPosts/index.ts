import { useSearchParams } from 'next/navigation'
import { getPagedArticlesParams } from '~/lib/pagedArticlesFilter'
import type { TPagedPosts, TResState, TTag } from '~/spec'
import useArticleList from '~/stores/articleList/hooks'
import useCommunity from '~/stores/community/hooks'

export type TUpdate = {
  pagedPosts: TPagedPosts
  tags: TTag[]
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

  const update = ({ pagedPosts, tags }: TUpdate) => {
    articleList$.commit({ pagedPosts, tags })
  }

  const pagedParams = getPagedArticlesParams(slug, searchParams)

  return {
    resState,
    pagedPosts,
    update,
    pagedParams,
  }
}
