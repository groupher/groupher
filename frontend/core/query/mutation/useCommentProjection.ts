'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useSyncExternalStore } from 'react'

import type { TComment } from '~/spec'

import { selectCommentFromCache, type TCommentScope } from './comment'

/** Subscribes to the canonical Comment projection without re-rendering for unrelated cache events. */
export default function useCommentProjection(comment: TComment, scope: TCommentScope): TComment {
  const queryClient = useQueryClient()
  const subscribe = useCallback(
    (notify: () => void) => queryClient.getQueryCache().subscribe(notify),
    [queryClient],
  )
  const getSnapshot = useCallback(
    () => selectCommentFromCache(queryClient, scope, comment),
    [comment, queryClient, scope],
  )

  return useSyncExternalStore(subscribe, getSnapshot, () => comment)
}
