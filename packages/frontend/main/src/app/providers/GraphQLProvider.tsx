'use client'

/**
 * this is for Graphql feching data on page load
 */

import { type FC, type ReactNode, useMemo } from 'react'
import { UrqlProvider, ssrExchange, cacheExchange, fetchExchange, createClient } from '@urql/next'

import { makeResult } from '@urql/core'
import { filter, pipe, merge, mergeMap, share, fromPromise } from 'wonka'

import { loadLocaleFile } from '~/i18n'
import { GRAPHQL_ENDPOINT } from '~/config'

type TProps = {
  children: ReactNode
}

/*
 * this is a interceptor, which intercepts the request and load data directly from fronten.
 * but for those query, the backend GraphQL should have a fake endpoint
 * big thanks to ChatGPT debug with me ~
 */
const localServeExchange = ({ forward }) => {
  return (ops$) => {
    const sharedOps$ = share(ops$)

    const interceptedOps$ = pipe(
      sharedOps$,
      // @ts-ignore
      filter(({ variables }) => Object.keys(variables).length === 1 && variables?.locale),
      mergeMap((operation) =>
        fromPromise(
          // @ts-ignore
          loadLocaleFile(operation.variables?.locale).then((result) =>
            // @ts-ignore
            makeResult(operation, { data: result }),
          ),
        ),
      ),
    )

    const forwardOps$ = pipe(
      sharedOps$,
      // @ts-ignore
      filter((operation) => !operation.variables?.locale),
      forward,
    )

    return merge([interceptedOps$, forwardOps$])
  }
}

const GraphQLProvider: FC<TProps> = ({ children }) => {
  const [client, ssr] = useMemo(() => {
    const ssr = ssrExchange()
    const client = createClient({
      url: GRAPHQL_ENDPOINT,
      // @ts-ignore
      exchanges: [cacheExchange, ssr, localServeExchange, fetchExchange],
      suspense: true,

      fetchOptions: () => ({
        headers: {
          special: 'Special header value',
          /*
           * NOTE: this SSR query better to keep it serverless
           */
          authorization: '',
        },
      }),
    })

    return [client, ssr]
  }, [])

  return (
    <UrqlProvider client={client} ssr={ssr}>
      {children}
    </UrqlProvider>
  )
}

export default GraphQLProvider
