'use client'

import { retryExchange } from '@urql/exchange-retry'
import { type FC, type ReactNode, useEffect, useMemo } from 'react'
import { cacheExchange, createClient, fetchExchange, Provider } from 'urql'

import { clearAuthState, sessionChannel } from '~/auth'
import { GRAPHQL_ENDPOINT } from '~/config'
import { createAuthFetch, GRAPHQL_FETCH_OPTIONS, GRAPHQL_RETRY_OPTIONS } from '~/graphql/client'

type TProps = { children: ReactNode }

const GraphQLProvider: FC<TProps> = ({ children }) => {
  const client = useMemo(() => {
    return createClient({
      url: GRAPHQL_ENDPOINT,
      exchanges: [cacheExchange, retryExchange(GRAPHQL_RETRY_OPTIONS), fetchExchange],
      fetch: createAuthFetch(),
      suspense: false,
      fetchOptions: GRAPHQL_FETCH_OPTIONS,
    })
  }, [])

  useEffect(() => {
    const channel = sessionChannel()
    if (!channel) return

    channel.onmessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === 'auth:logout' || event.data?.type === 'auth:invalid') {
        clearAuthState()
      }
    }

    return () => channel.close()
  }, [])

  return <Provider value={client}>{children}</Provider>
}

export default GraphQLProvider
