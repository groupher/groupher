import { equals, filter, find, includes, pluck, reject, uniq } from 'ramda'
import { useMemo } from 'react'

import { THREAD_PATH } from '~/const/thread'
import { sortById } from '~/helper'
import type { TCommunityThread, TNameAlias, TTag } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'

import { FIELD } from '../../constant'
import useTouch from '../useHelper/useTouch'

export type TRet = {
  tags: readonly TTag[]
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

  const { tags, original, activeTagThread, activeTagGroup, nameAlias } = dsb$

  const selectedThread = activeTagThread

  const threadTags = useMemo(() => {
    return filter((t: TTag) => t.thread === selectedThread, tags)
  }, [tags, selectedThread])

  const filteredTags = useMemo(() => {
    return activeTagGroup ? filter((t: TTag) => t.group === activeTagGroup, threadTags) : threadTags
  }, [activeTagGroup, threadTags])

  const groups = useMemo(() => {
    return uniq(pluck('group', threadTags))
  }, [threadTags])

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
    () => !equals(sortById(tags), sortById(original.tags || [])),
    [tags, original.tags],
  )

  return {
    tags: filteredTags,
    groups,
    threads,
    tagLayoutTouched,
    inlineTagLayoutTouched,
    tagsIndexTouched,
  }
}
