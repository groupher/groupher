import { find, propEq, reject } from 'ramda'
import { THREAD } from '~/const/thread'
import { sortByIndex } from '~/helper'
import useCommunity from '~/hooks/useCommunity'
import useDashboard from '~/hooks/useDashboard'
import type { TCommunityThread, TLinkItem, TNameAlias } from '~/spec'

export default (): TCommunityThread[] => {
  const dashboard = useDashboard()
  const curCommunity = useCommunity()

  // const { enable, nameAliasData } = store.dashboardThread

  const { threads } = curCommunity
  const enabledThreads = sortByIndex(threads.filter((thread) => dashboard.enable[thread.slug]))

  const mappedThreads = enabledThreads.map((pThread) => {
    const aliasItem = find(propEq(pThread.slug, 'slug'))(dashboard.nameAlias) as TNameAlias

    return {
      ...pThread,
      title: aliasItem?.name || pThread.title,
    }
  })

  const hasExtraAbout = find((link: TLinkItem) => link.title === '关于', dashboard.headerLinks)

  if (hasExtraAbout) {
    return reject(
      (item: TCommunityThread) => item.slug === THREAD.ABOUT,
      mappedThreads as TCommunityThread[],
    ) as TCommunityThread[]
  }

  return mappedThreads as TCommunityThread[]
}
