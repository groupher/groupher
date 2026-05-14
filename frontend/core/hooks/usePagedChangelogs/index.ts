import { useSearchParams } from 'next/navigation'

import { getPagedArticlesParams } from '~/lib/pagedArticlesFilter'
import type { TPagedChangelogs, TResState, TTagGroup } from '~/spec'
import useArticleList from '~/stores/articleList/hooks'
import useCommunity from '~/stores/community/hooks'

type TUpdate = {
  pagedChangelogs: TPagedChangelogs
  tagGroups: TTagGroup[]
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

  const update = ({ pagedChangelogs, tagGroups }: TUpdate) => {
    articleList.commit({ pagedChangelogs, tagGroups })
  }

  const pagedParams = getPagedArticlesParams(slug, searchParams)

  return {
    resState,
    pagedChangelogs,
    update,
    pagedParams,
  }
}
