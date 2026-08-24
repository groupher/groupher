'use client'

import type { ResultOf } from '@graphql-typed-document-node/core'
import { GROUPHER_AUTH_SIGNED_IN_COOKIE } from '@groupher/contracts/auth'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { use } from 'react'

import EVENT from '~/const/event'
import useEvent from '~/hooks/useEvent'
import { graphqlQueryOptions } from '~/query'
import type { TUser } from '~/spec'

import { sessionState } from '../../schemas/pages/user'
import { SessionSeedContext } from './context'

type TSessionResult = ResultOf<typeof sessionState>

const makeSessionResult = (user: TUser | null): TSessionResult =>
  ({
    sessionState: { isValid: Boolean(user), user },
  }) as TSessionResult

// This reads only the non-sensitive hint cookie. The real Phoenix token remains
// HttpOnly and is consumed by the same-origin GraphQL proxy when `me` is sent.
const hasSignedInHintCookie = (): boolean => {
  if (typeof document === 'undefined') return false

  return document.cookie
    .split(';')
    .map((item) => item.trim())
    .some((item) => item === `${GROUPHER_AUTH_SIGNED_IN_COOKIE}=1`)
}

export default function Hooks() {
  const seed = use(SessionSeedContext)
  const queryClient = useQueryClient()
  if (!seed) throw new Error('useAccount must be used within an Account store provider')

  const options = graphqlQueryOptions(sessionState, {})
  const shouldFetchMe = seed.loading !== false && hasSignedInHintCookie()

  const query = useQuery({
    ...options,
    enabled: shouldFetchMe,
    initialData: makeSessionResult(seed.user ?? null),
  })

  const clearSession = () => {
    queryClient.setQueryData(options.queryKey, makeSessionResult(null))
  }

  useEvent(EVENT.LOGOUT, clearSession, [queryClient])

  const session = query.data?.sessionState
  const user =
    session?.isValid && session.user
      ? {
          ...session.user,
          passport: session.user.passport as TUser['passport'],
        }
      : null
  const isLogin = Boolean(user)

  return {
    user,
    loading: shouldFetchMe && query.isFetching,
    isLogin,
    accountInfo: {
      ...user,
      isLogin,
      isValidSession: Boolean(session?.isValid),
      isModerator: false,
    },
  }
}
