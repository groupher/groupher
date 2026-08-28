import { find, includes, reject } from 'ramda'
import { useMemo } from 'react'

import { THREAD_PATH } from '~/const/thread'
import type { TCommunityThread, TNameAlias, TTag, TTagGroup } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDsb from '~/stores/dsb/hooks'

import { FIELD } from '../../constant'
import useTouch from '../useHelper/useTouch'

export type TRet = {
  tags: readonly TTag[]
  tagGroups: readonly TTagGroup[]
  groups: string[]
  threads: TCommunityThread[]
  tagLayoutTouched: boolean
  inlineTagLayoutTouched: boolean
}

/** Exposes derived state and actions through the shared React hook boundary. */
export default function useDerived(): TRet {
  const dsb$ = useDsb()
  const community$ = useCommunity()
  const { isChanged } = useTouch()

  const { tagGroups, activeTagGroup, nameAlias } = dsb$

  const filteredTags = useMemo(() => {
    const activeGroups = activeTagGroup
      ? tagGroups.filter((group) => group.id === activeTagGroup)
      : tagGroups

    return activeGroups.flatMap((group) => group.tags)
  }, [activeTagGroup, tagGroups])

  const groups = useMemo(() => tagGroups.map((group) => group.title), [tagGroups])

  const threads = useMemo(() => {
    const mappedThreads = community$.threads.map((pThread) => {
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

  const tagLayoutTouched = isChanged(FIELD.TAG_LAYOUT)
  const inlineTagLayoutTouched = isChanged(FIELD.INLINE_TAG_LAYOUT)

  return {
    tags: filteredTags,
    tagGroups,
    groups,
    threads,
    tagLayoutTouched,
    inlineTagLayoutTouched,
  }
}
