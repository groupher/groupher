'use client'

import { QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useEffect } from 'react'

import { AUTH_EVENT, clearAuthState, sessionChannel } from '~/auth'

import { viewerQueryKeys } from './key'
import { getQueryClient } from './queryClient'

const SessionQueryBoundary = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = sessionChannel()
    if (!channel) return

    channel.onmessage = (event: MessageEvent<{ type?: string }>) => {
      const type = event.data?.type
      if (type !== AUTH_EVENT.LOGOUT && type !== AUTH_EVENT.INVALID && type !== AUTH_EVENT.LOGIN) {
        return
      }

      void queryClient.removeQueries({ queryKey: viewerQueryKeys.all })
      if (type !== AUTH_EVENT.LOGIN) clearAuthState()
    }

    return () => channel.close()
  }, [queryClient])

  return children
}

export default function QueryProvider({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      <SessionQueryBoundary>{children}</SessionQueryBoundary>
    </QueryClientProvider>
  )
}
