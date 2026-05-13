import { equals, find, includes, reject } from 'ramda'
import { useMemo } from 'react'

import { THREAD_PATH } from '~/const/thread'
import type { TCommunityThread, TNameAlias, TTag, TTagGroup } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'

import { FIELD } from '../../constant'
import useTouch from '../useHelper/useTouch'

const tagSortSnapshot = (tagGroups: readonly TTagGroup[] = []) =>
  tagGroups
    .flatMap((group) => [
      {
        id: group.id,
        index: group.index ?? null,
        type: 'group',
      },
      ...group.tags
        .filter((tag) => tag.id)
        .map((tag) => ({
          id: tag.id,
          groupId: group.id,
          index: tag.index ?? null,
          type: 'tag',
        })),
    ])
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))

export type TRet = {
  tags: readonly TTag[]
  tagGroups: readonly TTagGroup[]
  groups: string[]
  threads: TCommunityThread[]
  tagLayoutTouched: boolean
  inlineTagLayoutTouched: boolean
  tagsIndexTouched: boolean
}

export default function useDerived(): TRet {
  const dsb$ = useDashboard()
  const community$ = useCommunity()
  const { isChanged } = useTouch()

  const { tagGroups, original, activeTagGroup, nameAlias } = dsb$

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

  const tagsIndexTouched = useMemo(
    () => !equals(tagSortSnapshot(tagGroups), tagSortSnapshot(original.tagGroups || [])),
    [tagGroups, original.tagGroups],
  )

  return {
    tags: filteredTags,
    tagGroups,
    groups,
    threads,
    tagLayoutTouched,
    inlineTagLayoutTouched,
    tagsIndexTouched,
  }
}
