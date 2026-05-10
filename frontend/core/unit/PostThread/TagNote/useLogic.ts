import { useEffect } from 'react'
import { useQuery } from 'urql'

import useActiveTag from '~/hooks/useActiveTag'
import type { TTag, TTagStats } from '~/spec'
import useArticleList from '~/stores/articleList/hooks'
import useCommunity from '~/stores/community/hooks'

import S from '../schema'

type TRet = {
  tag: TTag | null
  stats: TTagStats | null
}

export default function useLogic(): TRet {
  const tag = useActiveTag()
  const articleList$ = useArticleList()
  const { activeTagStats, commit, thread } = articleList$
  const { slug: community } = useCommunity()

  const [result] = useQuery({
    query: S.communityTagStats,
    variables: {
      community,
      thread,
      slug: tag?.slug,
    },
    pause: !community || !thread || !tag?.slug,
    requestPolicy: 'cache-and-network',
  })

  const resultVariables = result.operation?.variables as { slug?: string } | undefined
  const resultSlug = resultVariables?.slug
  const queryStats = resultSlug === tag?.slug ? result.data?.communityTagStats : null
  const initialStats = activeTagStats?.slug === tag?.slug ? activeTagStats : null
  const stats = queryStats || initialStats || null

  useEffect(() => {
    if (resultSlug !== tag?.slug || !queryStats || !tag?.slug) return

    if (
      activeTagStats?.slug === tag.slug &&
      activeTagStats.contentsCount === queryStats.contentsCount &&
      activeTagStats.todayContentsCount === queryStats.todayContentsCount
    ) {
      return
    }

    commit({ activeTagStats: { ...queryStats, slug: tag.slug } })
  }, [
    activeTagStats?.contentsCount,
    activeTagStats?.slug,
    activeTagStats?.todayContentsCount,
    commit,
    queryStats,
    resultSlug,
    tag?.slug,
  ])

  return { tag, stats }
}
