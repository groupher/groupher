'use client'

import { type FC, type ReactNode, useMemo } from 'react'
import { cacheExchange, createClient, fetchExchange, Provider } from 'urql'
import { GRAPHQL_ENDPOINT } from '~/config'
import { FETCH_OPTIONS } from '~/utils/graphql'

type TProps = { children: ReactNode }

const GraphQLProvider: FC<TProps> = ({ children }) => {
  const client = useMemo(() => {
    return createClient({
      url: GRAPHQL_ENDPOINT,
      exchanges: [cacheExchange, fetchExchange],
      suspense: false,
      fetchOptions: FETCH_OPTIONS,
    })
  }, [])

  return <Provider value={client}>{children}</Provider>
}

export default GraphQLProvider
