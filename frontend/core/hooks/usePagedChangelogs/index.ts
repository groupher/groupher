import { useSearchParams } from 'next/navigation'
import { getPagedArticlesParams } from '~/lib/pagedArticlesFilter'
import type { TPagedChangelogs, TResState, TTag } from '~/spec'
import useArticleList from '~/stores/articleList/hooks'
import useCommunity from '~/stores/community/hooks'

export type TUpdate = {
  pagedChangelogs: TPagedChangelogs
  tags: TTag[]
}

type TRes = {
  resState: TResState
  pagedChangelogs: TPagedChangelogs
  update: (params: TUpdate) => void
  pagedParams: ReturnType<typeof getPagedArticlesParams>
}

export default function usePagedChangelogs(): TRes {
  const articleList = useArticleList()
  const { slug } = useCommunity()
  const { pagedChangelogs, resState } = articleList

  // const pathname = usePathname()
  const searchParams = useSearchParams()

  const update = ({ pagedChangelogs, tags }: TUpdate) => {
    articleList.commit({ pagedChangelogs, tags })
  }

  const pagedParams = getPagedArticlesParams(slug, searchParams)

  return {
    resState,
    pagedChangelogs,
    update,
    pagedParams,
  }
}
