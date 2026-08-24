import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import URL_PARAM from '~/const/url_param'
import useViewingThread from '~/hooks/useViewingThread'
import { useSearchParams } from '~/platform'
import { Q } from '~/query'
import type { TTag } from '~/spec'
import useCommunity from '~/stores/community/hooks'

/** Exposes active tag state and actions through the shared React hook boundary. */
export default function useActiveTag(): TTag | null {
  const { slug: community } = useCommunity()
  const thread = useViewingThread()
  const searchParams = useSearchParams()
  const activeTagSlug = searchParams.get(URL_PARAM.TAG)
  const tagGroupsQuery = useQuery(Q.article.tagGroups(community, thread))

  return useMemo(() => {
    if (!activeTagSlug) return null

    return (
      (tagGroupsQuery.data || [])
        .flatMap((group) => group.tags)
        .find((tag) => tag.slug === activeTagSlug) || null
    )
  }, [activeTagSlug, tagGroupsQuery.data])
}
