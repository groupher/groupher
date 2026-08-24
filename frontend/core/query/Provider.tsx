'use client'

import { QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useEffect } from 'react'

import { clearAuthState, sessionChannel } from '~/auth'
import EVENT from '~/const/event'
import useEvent from '~/hooks/useEvent'
import type { TArticle } from '~/spec'
import useAccount from '~/stores/account/hooks'
import { toast } from '~/ui/Toaster'

import { viewerKeys } from './key'
import { mutateArticleUpvote } from './mutation/article'
import { getQueryClient } from './queryClient'

type TUpvotePayload = {
  data?: { article?: TArticle; viewerHasUpvoted?: boolean }
}

const ArticleMutationBridge = () => {
  const queryClient = useQueryClient()
  const account = useAccount()

  useEvent<TUpvotePayload>(
    EVENT.UPVOTE_ARTICLE,
    (_message, payload) => {
      const article = payload?.data?.article
      const nextViewerState = payload?.data?.viewerHasUpvoted
      const viewerScope = account.user?.login
      if (!article || typeof nextViewerState !== 'boolean' || !viewerScope) return

      void mutateArticleUpvote(queryClient, article, nextViewerState, viewerScope).catch(() => {
        toast('操作失败，请重试', 'error')
      })
    },
    [account.user?.login, queryClient],
  )

  return null
}

const SessionQueryBoundary = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = sessionChannel()
    if (!channel) return

    channel.onmessage = (event: MessageEvent<{ type?: string }>) => {
      const type = event.data?.type
      if (type !== 'auth:logout' && type !== 'auth:invalid' && type !== 'auth:login') return

      void queryClient.removeQueries({ queryKey: viewerKeys.all })
      if (type !== 'auth:login') clearAuthState()
    }

    return () => channel.close()
  }, [queryClient])

  return children
}

export default function QueryProvider({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      <SessionQueryBoundary>
        <ArticleMutationBridge />
        {children}
      </SessionQueryBoundary>
    </QueryClientProvider>
  )
}
