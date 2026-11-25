import { find, includes, reject } from 'ramda'
import { useMemo } from 'react'

import { THREAD_PATH } from '~/const/thread'
import type { TCommunityThread, TNameAlias, TTag, TTagGroup } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDsbShell from '~/stores/dsbShell/hooks'

export type TRet = {
  tags: readonly TTag[]
  tagGroups: readonly TTagGroup[]
  groups: string[]
  threads: TCommunityThread[]
}

/** Exposes derived state and actions through the shared React hook boundary. */
export default function useDerived(
  tagGroups: readonly TTagGroup[],
  activeGroupId: string | null,
): TRet {
  const dsb$ = useDsbShell()
  const community$ = useCommunity()

  const { nameAlias } = dsb$

  const filteredTags = useMemo(() => {
    const activeGroups = activeGroupId
      ? tagGroups.filter((group) => group.id === activeGroupId)
      : tagGroups

    return activeGroups.flatMap((group) => group.tags)
  }, [activeGroupId, tagGroups])

  const groups = useMemo(() => tagGroups.map((group) => group.title), [tagGroups])

  const threads = useMemo(() => {
    const mappedThreads = (community$.threads ?? []).map((pThread) => {
      const aliasItem = find((item: TNameAlias) => item.slug === pThread.slug, nameAlias) as
        | TNameAlias
        | undefined
      return {
        ...pThread,
        title: aliasItem && aliasItem.name !== aliasItem.original ? aliasItem.name : pThread.title,
      }
    })

    return reject(
      (thread: TCommunityThread) => includes(thread.slug, [THREAD_PATH.ABOUT, THREAD_PATH.DOC]),
      mappedThreads,
    )
  }, [community$.threads, nameAlias])

  return {
    tags: filteredTags,
    tagGroups,
    groups,
    threads,
  }
}
