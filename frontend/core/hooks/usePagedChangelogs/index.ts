import { useSearchParams } from 'next/navigation'
import { mergeRight, reject } from 'ramda'
import { HOME_COMMUNITY } from '~/const/name'
import URL_PARAM from '~/const/url_param'
import useArticleList from '~/hooks/useArticleList'
import useCommunity from '~/hooks/useCommunity'
import type { TPagedChangelogs, TResState, TTag } from '~/spec'
import { nilOrEmpty } from '~/validator'

type TPagedArticlesParams = {
  community: string
  cat?: string
  state?: string
  order?: string
}

export type TUpdate = {
  pagedChangelogs: TPagedChangelogs
  tags: TTag[]
}

type TRes = {
  resState: TResState
  pagedChangelogs: TPagedChangelogs
  update: (params: TUpdate) => void
  pagedParams: TPagedArticlesParams
}

const ARTICLES_FILTER = {
  community: HOME_COMMUNITY.slug,
  page: 1,
  size: 20,
}

const getArticlesParams = (community: string, searchParams: URLSearchParams) => {
  const filter = reject(nilOrEmpty)({
    community,
    page: Number(searchParams.get(URL_PARAM.PAGE)) || 1,
    articleTag: searchParams.get(URL_PARAM.TAG),
    cat: searchParams.get(URL_PARAM.CAT),
    state: searchParams.get(URL_PARAM.STATE),
    order: searchParams.get(URL_PARAM.ORDER),
  })

  return mergeRight(ARTICLES_FILTER, filter)
}

export default (): TRes => {
  const articleList = useArticleList()
  const { slug } = useCommunity()
  const { pagedChangelogs, resState } = articleList

  // const pathname = usePathname()
  const searchParams = useSearchParams()

  const update = ({ pagedChangelogs, tags }: TUpdate) => {
    articleList.commit({ pagedChangelogs, tags })
  }

  const pagedParams = getArticlesParams(slug, searchParams)

  return {
    resState,
    pagedChangelogs,
    update,
    pagedParams,
  }
}
