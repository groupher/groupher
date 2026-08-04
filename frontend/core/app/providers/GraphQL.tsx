'use client'

import { retryExchange } from '@urql/exchange-retry'
import { type FC, type ReactNode, useMemo } from 'react'
import { cacheExchange, createClient, fetchExchange, Provider } from 'urql'

import { GRAPHQL_ENDPOINT } from '~/config'
import { GRAPHQL_FETCH_OPTIONS, GRAPHQL_RETRY_OPTIONS } from '~/graphql/client'

type TProps = { children: ReactNode }

const GraphQLProvider: FC<TProps> = ({ children }) => {
  const client = useMemo(() => {
    return createClient({
      url: GRAPHQL_ENDPOINT,
      exchanges: [cacheExchange, retryExchange(GRAPHQL_RETRY_OPTIONS), fetchExchange],
      suspense: false,
      fetchOptions: GRAPHQL_FETCH_OPTIONS,
    })
  }, [])

  return <Provider value={client}>{children}</Provider>
}

export default GraphQLProvider
