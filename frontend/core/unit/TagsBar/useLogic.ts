import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import TYPE from '~/const/type'
import URL_PARAM from '~/const/url_param'
import { groupByKey } from '~/helper'
import useActiveTag from '~/hooks/useActiveTag'
import type { TGroupedTags, TResState, TTag } from '~/spec'
import useArticleList from '~/stores/articleList/hooks'

type TRet = {
  tags: readonly TTag[]
  activeTag: TTag | null

  groupedTags: TGroupedTags
  onTagSelect: (tag?: TTag) => void

  maxDisplayCount: number
  totalCountThreshold: number
}

export default function useLogic(): TRet {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const store = useArticleList()
  const { tags } = store
  const activeTag = useActiveTag()
  const loadingState = TYPE.RES_STATE.LOADING as TResState

  // derived data
  const groupedTags = useMemo<TGroupedTags>(() => {
    return groupByKey(tags, 'group')
  }, [tags])

  const onTagSelect = (tag?: TTag): void => {
    const nextSearchParams = new URLSearchParams(searchParams.toString())
    nextSearchParams.delete(URL_PARAM.PAGE)

    if (tag?.slug) {
      nextSearchParams.set(URL_PARAM.TAG, tag.slug)
    } else {
      nextSearchParams.delete(URL_PARAM.TAG)
    }

    const nextQuery = nextSearchParams.toString()
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname

    store.commit({ resState: loadingState })
    setTimeout(() => router.push(nextUrl), 0)
  }

  return {
    tags,
    activeTag,

    groupedTags,
    onTagSelect,

    maxDisplayCount: 3,
    totalCountThreshold: 10,
  }
}
