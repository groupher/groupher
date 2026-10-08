'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import useTrans from '~/hooks/useTrans'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import useCommunity from '~/stores/community/hooks'
import { toast } from '~/ui/Toaster'
import S from '~/unit/DsbThread/schema/content'

import { normalizeTrashedPost } from './normalize'
import type { TPagedTrashedPosts, TTrashedPostsData } from './spec'

const PAGE_SIZE = 20
const EMPTY_PAGE: TPagedTrashedPosts = {
  entries: [],
  pageNumber: 1,
  pageSize: PAGE_SIZE,
  totalCount: 0,
  totalPages: 0,
}

const normalizePage = (page: TTrashedPostsData['trashedArticles']): TPagedTrashedPosts => ({
  ...page,
  entries: page.entries.map(normalizeTrashedPost),
})

/** Exposes trashed posts state and actions through the shared React hook boundary. */
export default function useTrashedPosts(initialData?: TPagedTrashedPosts | null) {
  const { slug: community } = useCommunity()
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
        const data = await browserGraphQLRequest<TTrashedPostsData>(S.trashedPosts, {
          community,
          page: targetPage,
          size: PAGE_SIZE,
        })

        if (sequence !== requestSequence.current) return
        setPagedPosts(data.trashedArticles ? normalizePage(data.trashedArticles) : EMPTY_PAGE)
      } catch (error) {
        if (sequence !== requestSequence.current) return
        toast(String(error), 'error')
      } finally {
        if (sequence === requestSequence.current) setLoading(false)
      }
    },
    [community],
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
        const data = await executeCommand({
          request: (variables) => browserGraphQLRequest(S.restoreTrashedPost, variables),
          variables: {
            community,
            id,
          },
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
    [activeActionId, community, refreshAfterRemoval, t],
  )

  const permanentlyDelete = useCallback(
    async (id: string): Promise<boolean> => {
      if (activeActionId !== null) return false
      setActiveActionId(id)

      try {
        const data = await executeCommand({
          request: (variables) => browserGraphQLRequest(S.permanentlyDeleteTrashedPost, variables),
          variables: { community, id },
        })

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
    [activeActionId, community, refreshAfterRemoval, t],
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
