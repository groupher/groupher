import { find, propEq, reject } from 'ramda'
import { THREAD } from '~/const/thread'
import { sortByIndex } from '~/helper'
import { shouldFoldAboutToMore } from '~/hooks/useHeaderLinks/helper'
import type { TCommunityThread, TNameAlias } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'

export default function usePublicThreads(): TCommunityThread[] {
  const dsb$ = useDashboard()
  const { slug: community, threads } = useCommunity()

  const enabledThreads = sortByIndex(threads.filter((thread) => dsb$.enable[thread.slug]))

  const mappedThreads = enabledThreads.map((pThread) => {
    const aliasItem = find(propEq(pThread.slug, 'slug'))(dsb$.nameAlias) as TNameAlias

    return {
      ...pThread,
      title: aliasItem?.name || pThread.title,
    }
  })

  const shouldFoldAbout = shouldFoldAboutToMore(dsb$.headerLinks, community)

  if (shouldFoldAbout) {
    return reject(
      (item: TCommunityThread) => item.slug === THREAD.ABOUT,
      mappedThreads as TCommunityThread[],
    ) as TCommunityThread[]
  }

  return mappedThreads as TCommunityThread[]
}
