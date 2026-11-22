'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import useTrans from '~/hooks/useTrans'
import { articleQueryKeys, viewerQueryKeys } from '~/query'
import { markStalePrefix } from '~/query/invalidation'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import useAccount from '~/stores/account/hooks'
import useCommunity from '~/stores/community/hooks'
import { toast } from '~/ui/Toaster'
import S from '~/unit/DsbThread/schema/content'

type TOrdinaryThread = 'POST' | 'BLOG' | 'CHANGELOG'

/** Hides selected Article Bindings from only the current Community. */
export default function useHideCommunityArticles(thread: TOrdinaryThread) {
  const { slug: communityRef } = useCommunity()
  const { accountScope } = useAccount()
  const { t } = useTrans()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)

  const hide = useCallback(
    async (articleIds: string[]): Promise<boolean> => {
      if (loading || articleIds.length === 0) return false
      setLoading(true)
      const failures: unknown[] = []

      try {
        for (const articleId of articleIds) {
          try {
            const result = await executeCommand({
              request: (variables) => browserGraphQLRequest(S.hideCommunityArticle, variables),
              variables: { communityRef, thread, articleId },
            })
            if (!result.hideCommunityArticle)
              failures.push(new Error('Community hide was rejected'))
          } catch (error) {
            failures.push(error)
          }
        }

        await markStalePrefix(queryClient, articleQueryKeys.all)
        await markStalePrefix(queryClient, [
          ...viewerQueryKeys.all,
          accountScope,
          'community-article-trash',
          communityRef,
          thread,
        ])
        if (failures.length > 0) {
          toast(String(failures[0]), 'error')
          return false
        }

        toast(t('dsb.cms.community_trash.hidden'))
        return true
      } finally {
        setLoading(false)
      }
    },
    [accountScope, communityRef, loading, queryClient, t, thread],
  )

  return { hide, loading }
}
