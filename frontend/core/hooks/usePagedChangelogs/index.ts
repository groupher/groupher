import { getPagedArticlesParams } from '~/lib/pagedArticlesFilter'
import { useSearchParams } from '~/platform'
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

/** Exposes paged changelogs state and actions through the shared React hook boundary. */
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
