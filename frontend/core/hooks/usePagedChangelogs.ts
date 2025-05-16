import { reject, mergeRight } from 'ramda'
import { useSearchParams } from 'next/navigation'

import type { TPagedChangelogs, TResState } from '~/spec'
import useSubStore from '~/hooks/useSubStore'
import { nilOrEmpty } from '~/validator'

import { HCN } from '~/const/name'
import URL_PARAM from '~/const/url_param'

type TPagedArticlesParams = {
  community: string
  cat?: string
  state?: string
  order?: string
}

type TRes = {
  resState: TResState
  pagedChangelogs: TPagedChangelogs
  update: (pagedChangelogs: TPagedChangelogs) => void
  pagedParams: TPagedArticlesParams
}

const ARTICLES_FILTER = {
  community: HCN,
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
  const articlesStore = useSubStore('articles')
  const viewingStore = useSubStore('viewing')
  const { pagedChangelogs, resState } = articlesStore

  // const pathname = usePathname()
  const searchParams = useSearchParams()

  const update = (pagedChangelogs: TPagedChangelogs) => {
    articlesStore.commit({ pagedChangelogs })
  }

  const pagedParams = getArticlesParams(viewingStore.community.slug, searchParams)

  return {
    resState,
    pagedChangelogs,
    update,
    pagedParams,
  }
}
