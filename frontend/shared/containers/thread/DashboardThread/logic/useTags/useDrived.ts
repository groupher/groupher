import { useCallback } from 'react'
import { reject, find, propEq, filter, includes, pluck, uniq, equals } from 'ramda'

import type { TTag, TCommunityThread, TNameAlias } from '~/spec'
import { sortByIndex } from '~/helper'
import { THREAD } from '~/const/thread'

import useSubState from '~/hooks/useSubStore'
import useViewingCommunity from '~/hooks/useViewingCommunity'

export type TRet = {
  getTags: () => TTag[]
  getGroups: () => string[]
  getThreads: () => TCommunityThread[]
  getTagLayoutTouched: () => boolean
  getTagsIndexTouched: () => boolean
}

export default (): TRet => {
  const store = useSubState('dashboard')
  const curCommunity = useViewingCommunity()

  const { tags, original, activeTagThread, activeTagGroup, nameAlias, tagLayout } = store

  const getTags = useCallback(() => {
    const selectedThread = (activeTagThread || '').toUpperCase()

    const filterdTagsByGroup = activeTagGroup
      ? filter((t: TTag) => t.group === activeTagGroup, tags)
      : tags

    return filter((t: TTag) => t.thread === selectedThread, filterdTagsByGroup)
  }, [tags, activeTagThread, activeTagGroup])

  const getGroups = useCallback((): string[] => uniq(pluck('group', tags)), [tags])

  const getThreads = useCallback((): TCommunityThread[] => {
    const mappedThreads = curCommunity.threads.map((pThread) => {
      const aliasItem = find(propEq(pThread.slug, 'slug'))(nameAlias) as TNameAlias

      return {
        ...pThread,
        title: aliasItem?.name || pThread.title,
      }
    })

    return reject(
      (thread: TCommunityThread) => includes(thread.slug, [THREAD.ABOUT, THREAD.DOC]),
      mappedThreads,
    )
  }, [curCommunity, nameAlias])

  const getTagLayoutTouched = useCallback((): boolean => {
    return !equals(tagLayout, original.tagLayout)
  }, [tagLayout, original.tagLayout])

  const getTagsIndexTouched = useCallback((): boolean => {
    return !equals(sortByIndex(tags, 'id'), sortByIndex(original.tags || [], 'id'))
  }, [tags, original.tags])

  return {
    getTags,
    getGroups,
    getThreads,
    getTagLayoutTouched,
    getTagsIndexTouched,
  }
}
