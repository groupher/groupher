'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import usePagiPosition from '~/hooks/usePagiPosition'
import useTrans from '~/hooks/useTrans'
import { viewerQueryKeys } from '~/query'
import { markStalePrefix } from '~/query/invalidation'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import useAccount from '~/stores/account/hooks'
import useCommunity from '~/stores/community/hooks'
import { toast } from '~/ui/Toaster'
import S from '~/unit/DsbThread/schema/content'

import { normalizeTrashedPost } from './normalize'
import type { TPagedTrashedPosts, TRawPagedTrashedPosts, TTrashedPostsData } from './spec'

const PAGE_SIZE = 20
const EMPTY_PAGE: TPagedTrashedPosts = {
  entries: [],
  pageInfo: {
    __typename: 'OffsetPageInfo',
    page: 1,
    size: PAGE_SIZE,
    totalCount: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  },
}

const normalizePage = (page: TTrashedPostsData['trashedArticles']): TPagedTrashedPosts => ({
  ...page,
  entries: page.entries.map(normalizeTrashedPost),
})

/** Exposes trashed posts state and actions through the shared React hook boundary. */
export default function useTrashedPosts(initialData?: TRawPagedTrashedPosts | null) {
  const { slug: community } = useCommunity()
  const { t } = useTrans()
  const { accountScope } = useAccount()
  const queryClient = useQueryClient()
  const scope = `${accountScope}:${community}`
  const [seedScope] = useState(scope)
  const position = usePagiPosition(scope, PAGE_SIZE)
  const page = position.request.api === 'offset' ? position.request.page : 1
  const setPage = position.setPage
  const [activeActionId, setActiveActionId] = useState<string | null>(null)
  const queryRoot = [...viewerQueryKeys.all, accountScope, 'article-trash', community]
  const query = useQuery({
    queryKey: [...queryRoot, position.input],
    queryFn: async () =>
      (
        await browserGraphQLRequest<TTrashedPostsData>(S.trashedPosts, {
          community,
          pagi: position.input,
        })
      ).trashedArticles,
    initialData: scope === seedScope && page === 1 ? (initialData ?? undefined) : undefined,
    select: normalizePage,
    enabled: !!accountScope && !!community,
  })
  const pagedPosts = query.data ?? EMPTY_PAGE

  const refreshAfterRemoval = async (): Promise<void> => {
    await markStalePrefix(queryClient, queryRoot)
    if (pagedPosts.entries.length === 1 && page > 1) {
      setPage(page - 1)
    } else {
      await query.refetch()
    }
  }

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
    loading: query.isFetching,
    error: query.error,
    retry: query.refetch,
    page,
    pagedPosts,
    permanentlyDelete,
    restore,
    setPage,
  }
}
