import { useSearchParams } from 'next/navigation'
import { useMemo } from 'react'

import URL_PARAM from '~/const/url_param'
import type { TTag } from '~/spec'
import useArticleList from '~/stores/articleList/hooks'

export default function useActiveTag(): TTag | null {
  const articleList$ = useArticleList()
  const searchParams = useSearchParams()
  const activeTagSlug = searchParams.get(URL_PARAM.TAG)

  return useMemo(() => {
    if (!activeTagSlug) return null

    return (
      articleList$.tagGroups
        .flatMap((group) => group.tags)
        .find((tag) => tag.slug === activeTagSlug) || null
    )
  }, [activeTagSlug, articleList$.tagGroups])
}
