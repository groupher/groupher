import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CAT, ORDER, STATE } from '~/const/gtd'
import TYPE from '~/const/type'
import URL_PARAM from '~/const/url_param'
import type { TArticleCat, TArticleFilter, TArticleOrder, TArticleState, TResState } from '~/spec'
import useArticleList from '~/stores/articleList/hooks'

type TRes = {
  cat: TArticleCat
  state: TArticleState
  order: TArticleOrder
  updateActiveFilter: (filter: TArticleFilter) => void
}

export default function useArticlesFilter(): TRes {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const store = useArticleList()
  const loadingState = TYPE.RES_STATE.LOADING as TResState

  const order = (searchParams.get(URL_PARAM.ORDER) as TArticleOrder) || null
  const state = (searchParams.get(URL_PARAM.STATE) as TArticleState) || null
  const cat = (searchParams.get(URL_PARAM.CAT) as TArticleCat) || null

  const updateActiveFilter = (filter: TArticleFilter) => {
    const nextSearchParams = new URLSearchParams(searchParams.toString())
    nextSearchParams.delete(URL_PARAM.PAGE)

    if (Object.hasOwn(filter, CAT)) {
      if (filter.cat) {
        nextSearchParams.set(URL_PARAM.CAT, filter.cat)
      } else {
        nextSearchParams.delete(URL_PARAM.CAT)
      }
    }

    if (Object.hasOwn(filter, STATE)) {
      if (filter.state) {
        nextSearchParams.set(URL_PARAM.STATE, filter.state)
      } else {
        nextSearchParams.delete(URL_PARAM.STATE)
      }
    }

    if (Object.hasOwn(filter, ORDER)) {
      if (filter.order) {
        nextSearchParams.set(URL_PARAM.ORDER, filter.order)
      } else {
        nextSearchParams.delete(URL_PARAM.ORDER)
      }
    }

    const nextQuery = nextSearchParams.toString()
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname

    store.commit({ resState: loadingState })
    router.push(nextUrl)
  }

  return {
    order,
    cat,
    state,
    updateActiveFilter,
  }
}
