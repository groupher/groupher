import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ARTICLE_CAT, ARTICLE_ORDER, ARTICLE_STATE, CAT, ORDER, STATE } from '~/const/gtd'
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

const toValidFilterValue = <TValue extends string>(
  value: string | null,
  allowedValues: readonly TValue[],
): TValue | null => {
  if (!value) return null

  return allowedValues.includes(value as TValue) ? (value as TValue) : null
}

export default function useArticlesFilter(): TRes {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const store = useArticleList()
  const loadingState = TYPE.RES_STATE.LOADING as TResState

  const order = toValidFilterValue(
    searchParams.get(URL_PARAM.ORDER),
    Object.values(ARTICLE_ORDER),
  ) as TArticleOrder | null
  const state = toValidFilterValue(
    searchParams.get(URL_PARAM.STATE),
    Object.values(ARTICLE_STATE),
  ) as TArticleState | null
  const cat = toValidFilterValue(searchParams.get(URL_PARAM.CAT), Object.values(ARTICLE_CAT)) as
    | TArticleCat
    | null

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
    const currentQuery = searchParams.toString()
    const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname

    if (nextUrl === currentUrl) return

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
