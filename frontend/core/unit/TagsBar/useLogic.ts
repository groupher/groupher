import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo } from 'react'

import TYPE from '~/const/type'
import URL_PARAM from '~/const/url_param'
import useActiveTag from '~/hooks/useActiveTag'
import type { TGroupedTags, TResState, TTag } from '~/spec'
import useArticleList from '~/stores/articleList/hooks'

type TRet = {
  tags: readonly TTag[]
  activeTag: TTag | null

  groupedTags: TGroupedTags
  groupKeys: string[]
  onTagSelect: (tag?: TTag) => void

  maxDisplayCount: number
  totalCountThreshold: number
}

export default function useLogic(): TRet {
  const { push } = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const store = useArticleList()
  const { tagGroups } = store
  const activeTag = useActiveTag()
  const loadingState = TYPE.RES_STATE.LOADING as TResState

  // derived data
  const { tags, groupedTags, groupKeys } = useMemo(() => {
    const tags = tagGroups.flatMap((group) => group.tags)
    const groupedTags = {} as TGroupedTags
    const groupKeys = tagGroups.map((group) => group.title)

    tagGroups.forEach((group) => {
      groupedTags[group.title] = [...group.tags]
    })

    return { tags, groupedTags, groupKeys }
  }, [tagGroups])

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
    setTimeout(() => push(nextUrl), 0)
  }

  return {
    tags,
    activeTag,

    groupedTags,
    groupKeys,
    onTagSelect,

    maxDisplayCount: 3,
    totalCountThreshold: 10,
  }
}
