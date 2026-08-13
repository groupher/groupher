'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import useGraphQLClient from '~/hooks/useGraphQLClient'
import useTrans from '~/hooks/useTrans'
import useCommunity from '~/stores/community/hooks'
import { toast } from '~/ui/Toaster'
import S from '~/unit/DashboardThread/schema/content'

import type {
  TPagedTrashedPosts,
  TPermanentlyDeleteTrashedPostData,
  TRestoreTrashedPostData,
  TTrashedPostsData,
} from './spec'

const PAGE_SIZE = 20
const EMPTY_PAGE: TPagedTrashedPosts = {
  entries: [],
  pageNumber: 1,
  pageSize: PAGE_SIZE,
  totalCount: 0,
  totalPages: 0,
}

/** Exposes trashed posts state and actions through the shared React hook boundary. */
export default function useTrashedPosts(initialData?: TPagedTrashedPosts | null) {
  const { slug: community } = useCommunity()
  const { query, mutate } = useGraphQLClient()
  const { t } = useTrans()
  const requestSequence = useRef(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(!initialData)
  const [activeActionId, setActiveActionId] = useState<string | null>(null)
  const [pagedPosts, setPagedPosts] = useState<TPagedTrashedPosts>(initialData ?? EMPTY_PAGE)

  const loadPage = useCallback(
    async (targetPage: number): Promise<void> => {
      const sequence = ++requestSequence.current
      setLoading(true)

      try {
        const data = await query<TTrashedPostsData>(
          S.trashedPosts,
          { community, page: targetPage, size: PAGE_SIZE },
          { requestPolicy: 'network-only' },
        )

        if (sequence !== requestSequence.current) return
        setPagedPosts(data.trashedArticles ?? EMPTY_PAGE)
      } catch (error) {
        if (sequence !== requestSequence.current) return
        toast(String(error), 'error')
      } finally {
        if (sequence === requestSequence.current) setLoading(false)
      }
    },
    [community, query],
  )

  const hasInitialData = Boolean(initialData)

  useEffect(() => {
    if (hasInitialData && page === 1) return

    void loadPage(page)
  }, [hasInitialData, loadPage, page])

  const refreshAfterRemoval = useCallback(async (): Promise<void> => {
    if (pagedPosts.entries.length === 1 && page > 1) {
      setPage((current) => current - 1)
      return
    }

    await loadPage(page)
  }, [loadPage, page, pagedPosts.entries.length])

  const restore = useCallback(
    async (id: string): Promise<boolean> => {
      if (activeActionId !== null) return false
      setActiveActionId(id)

      try {
        const data = await mutate<TRestoreTrashedPostData>(S.restoreTrashedPost, {
          community,
          id,
        })

        if (!data.restoreTrashedArticle) return false
        toast(t('dsb.cms.trash.restored'))
        await refreshAfterRemoval()
        return true
      } catch (error) {
        toast(String(error), 'error')
        return false
      } finally {
        setActiveActionId(null)
      }
    },
    [activeActionId, community, mutate, refreshAfterRemoval, t],
  )

  const permanentlyDelete = useCallback(
    async (id: string): Promise<boolean> => {
      if (activeActionId !== null) return false
      setActiveActionId(id)

      try {
        const data = await mutate<TPermanentlyDeleteTrashedPostData>(
          S.permanentlyDeleteTrashedPost,
          { community, id },
        )

        if (!data.permanentlyDeleteTrashedArticle?.done) return false
        toast(t('dsb.cms.trash.permanently_deleted'))
        await refreshAfterRemoval()
        return true
      } catch (error) {
        toast(String(error), 'error')
        return false
      } finally {
        setActiveActionId(null)
      }
    },
    [activeActionId, community, mutate, refreshAfterRemoval, t],
  )

  return {
    activeActionId,
    loading,
    page,
    pagedPosts,
    permanentlyDelete,
    restore,
    setPage,
  }
}
