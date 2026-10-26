'use client'

import type { ResultOf } from '@graphql-typed-document-node/core'
import { GROUPHER_AUTH_SIGNED_IN_COOKIE } from '@groupher/contracts/auth'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'

import { AUTH_EVENT, sessionChannel } from '~/auth'
import EVENT from '~/const/event'
import useEvent from '~/hooks/useEvent'
import { localDraftRepository } from '~/lib/localDraftHistory'
import { Q } from '~/query'
import { viewerQueryKeys } from '~/query/key'
import { clearArticleUpvoteReceipts } from '~/query/mutation/articleReceipt'
import { clearCommentReactionReceipts } from '~/query/mutation/commentReactionReceipt'
import { clearCommentFeedReceipts } from '~/query/mutation/commentReceipt'
import { clearArticleViewAcks } from '~/query/viewAck'
import { clearViewerSessionCache } from '~/query/viewer'
import { sessionState } from '~/schemas/pages/user'
import type { TAuthenticatedUser, TUser } from '~/spec'

import { getAccountScope } from './accountScope'
import { AccountContext, SessionSeedContext } from './context'
import type { TInit } from './spec'

type TProps = {
  children: ReactNode
  initData?: TInit
}

type TSessionResult = ResultOf<typeof sessionState>

const makeSessionResult = (user: TUser | null): TSessionResult =>
  ({ sessionState: { isValid: Boolean(user), user } }) as TSessionResult

const hasSignedInHintCookie = (): boolean =>
  typeof document !== 'undefined' &&
  document.cookie
    .split(';')
    .map((item) => item.trim())
    .some((item) => item === `${GROUPHER_AUTH_SIGNED_IN_COOKIE}=1`)

const subscribeHydration = (): (() => void) => () => {}

export default function Provider({ children, initData }: TProps) {
  const seed = initData ?? { loading: true, user: null }
  const queryClient = useQueryClient()
  const isHydrated = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  )
  const options = Q.viewer.session()
  const shouldFetchSession =
    isHydrated && hasSignedInHintCookie() && (seed.loading !== false || !seed.user)
  const sessionSeed = makeSessionResult(seed.user ?? null)
  const hasResolvedUserSeed = seed.loading === false && Boolean(seed.user)
  const query = useQuery({
    ...options,
    enabled: shouldFetchSession,
    // Anonymous state is only a render fallback. Caching it as fresh data would suppress the
    // post-hydration session probe for a browser that still carries the signed-in hint.
    initialData: hasResolvedUserSeed ? sessionSeed : undefined,
    placeholderData: hasResolvedUserSeed ? undefined : sessionSeed,
  })
  const session = query.data?.sessionState
  const user = useMemo(
    () =>
      session?.isValid && session.user
        ? ({
            ...session.user,
            passport: session.user.passport as TUser['passport'],
          } as TAuthenticatedUser)
        : null,
    [session],
  )
  const accountScope = getAccountScope(user)
  const refreshSession = useCallback(async (): Promise<void> => {
    await query.refetch()
  }, [query.refetch])

  const clearSession = useCallback(() => {
    clearArticleUpvoteReceipts(accountScope)
    clearCommentFeedReceipts(accountScope)
    clearCommentReactionReceipts(accountScope)
    clearArticleViewAcks()
    clearViewerSessionCache(queryClient)
    if (accountScope) void localDraftRepository.clearAccount(accountScope)
  }, [accountScope, queryClient])

  useEvent(EVENT.LOGOUT, clearSession, [clearSession])

  useEffect(() => {
    const channel = sessionChannel()
    if (!channel) return

    channel.onmessage = (event: MessageEvent<{ type?: string }>) => {
      const type = event.data?.type
      if (type === AUTH_EVENT.LOGIN) {
        void queryClient.removeQueries({ queryKey: viewerQueryKeys.all })
      } else if (type === AUTH_EVENT.LOGOUT || type === AUTH_EVENT.INVALID) {
        clearSession()
      }
    }

    return () => channel.close()
  }, [clearSession, queryClient])

  const previousAccountScope = useRef<string | null>(accountScope)

  useEffect(() => {
    const previous = previousAccountScope.current
    if (previous !== accountScope) {
      if (previous) {
        clearArticleUpvoteReceipts(previous)
        clearCommentFeedReceipts(previous)
        clearCommentReactionReceipts(previous)
      }
      void queryClient.removeQueries({
        predicate: (query) =>
          query.queryKey[0] === viewerQueryKeys.all[0] && query.queryKey[1] !== 'session',
      })
      clearArticleViewAcks()
    }
    previousAccountScope.current = accountScope
  }, [accountScope, queryClient])

  const value = useMemo(
    () => ({
      user,
      accountScope,
      refreshSession,
      // Anonymous initial data is renderable. Background Session recovery must
      // not block optional-auth products behind an account skeleton.
      loading: query.isPending,
      isLogin: Boolean(user),
      accountInfo: {
        ...user,
        isLogin: Boolean(user),
        isValidSession: Boolean(session?.isValid),
        isModerator: false,
      },
    }),
    [accountScope, query.isPending, refreshSession, session, user],
  )

  return (
    <SessionSeedContext.Provider value={seed}>
      <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
    </SessionSeedContext.Provider>
  )
}
