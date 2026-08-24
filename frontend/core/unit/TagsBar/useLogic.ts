import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import URL_PARAM from '~/const/url_param'
import useActiveTag from '~/hooks/useActiveTag'
import useViewingThread from '~/hooks/useViewingThread'
import { usePathname, useRouter, useSearchParams } from '~/platform'
import { Q } from '~/query'
import type { TGroupedTags, TTag } from '~/spec'
import useCommunity from '~/stores/community/hooks'

type TRet = {
  tags: readonly TTag[]
  activeTag: TTag | null

  groupedTags: TGroupedTags
  groupKeys: string[]
  onTagSelect: (tag?: TTag) => void

  maxDisplayCount: number
  totalCountThreshold: number
}

/** Exposes logic state and actions through the shared React hook boundary. */
export default function useLogic(): TRet {
  const { push } = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { slug: community } = useCommunity()
  const thread = useViewingThread()
  const tagGroups = useQuery(Q.article.tagGroups(community, thread)).data || []
  const activeTag = useActiveTag()

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
