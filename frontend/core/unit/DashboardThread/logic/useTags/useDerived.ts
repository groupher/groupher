import { equals, filter, find, includes, pluck, reject, uniq } from 'ramda'
import { useMemo } from 'react'

import { THREAD_PATH } from '~/const/thread'
import { sortById } from '~/helper'
import type { TCommunityThread, TNameAlias, TTag } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'

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

  const { tags, original, activeTagThread, activeTagGroup, nameAlias, tagLayout, inlineTagLayout } =
    dsb$

  const selectedThread = activeTagThread

  const filteredTags = useMemo(() => {
    const filteredByGroup = activeTagGroup
      ? filter((t: TTag) => t.group === activeTagGroup, tags)
      : tags
    return filter((t: TTag) => t.thread === selectedThread, filteredByGroup)
  }, [tags, activeTagGroup, selectedThread])

  const groups = useMemo(() => uniq(pluck('group', tags)), [tags])

  const threads = useMemo(() => {
    const mappedThreads = community$.threads.map((pThread) => {
      const aliasItem = find((item: TNameAlias) => item.slug === pThread.slug, nameAlias) as
        | TNameAlias
        | undefined
      return {
        ...pThread,
        title: aliasItem?.name || pThread.title,
      }
    })

    return reject(
      (thread: TCommunityThread) => includes(thread.slug, [THREAD_PATH.ABOUT, THREAD_PATH.DOC]),
      mappedThreads,
    )
  }, [community$.threads, nameAlias])

  const tagLayoutTouched = useMemo(
    () => !equals(tagLayout, original.tagLayout),
    [tagLayout, original.tagLayout],
  )

  const inlineTagLayoutTouched = useMemo(
    () => !equals(inlineTagLayout, original.inlineTagLayout),
    [inlineTagLayout, original.inlineTagLayout],
  )

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
