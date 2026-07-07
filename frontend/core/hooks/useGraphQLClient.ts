'use client'

import type { AnyVariables, DocumentInput, OperationContext } from '@urql/core'
import { useCallback } from 'react'
import { useClient } from 'urql'

type TClarifyInput = null | TClarifyObject | TClarifyArray
type TClarifyArray = Array<TClarifyInput>
type TClarifyObject = { [key: string]: TClarifyInput }

const clarify = (obj: TClarifyInput): TClarifyInput => {
  if (obj === null) return null
  if (Array.isArray(obj)) return obj.map(clarify)
  if (typeof obj === 'object') {
    const newObj: TClarifyObject = {}
    for (const key of Object.keys(obj)) newObj[key] = clarify(obj[key])
    if ('__typename' in newObj) delete newObj.__typename
    return newObj
  }
  return obj
}

const clarifyVariables = <TVars extends AnyVariables>(variables?: TVars): TVars => {
  return clarify((variables ?? {}) as TClarifyInput) as TVars
}

/**
 * Imperative GraphQL client wrapper for event handlers and store actions.
 *
 * urql cache objects often contain `__typename`, but mutation inputs cannot
 * send that field back to Absinthe. The wrapper recursively strips it from
 * variables, unwraps urql promises, and throws GraphQL/network errors so callers
 * can use ordinary try/catch flows.
 */
export default function useGraphQL() {
  const client = useClient()

  const query = useCallback(
    async <TData, TVars extends AnyVariables = AnyVariables>(
      schema: DocumentInput<TData, TVars>,
      variables?: TVars,
      context?: Partial<OperationContext>,
    ) => {
      const res = await client
        .query<TData, TVars>(schema, clarifyVariables(variables), context)
        .toPromise()
      if (res.error) throw res.error
      return res.data as TData
    },
    [client],
  )

  const mutate = useCallback(
    async <TData, TVars extends AnyVariables = AnyVariables>(
      schema: DocumentInput<TData, TVars>,
      variables?: TVars,
      context?: Partial<OperationContext>,
    ) => {
      const res = await client
        .mutation<TData, TVars>(schema, clarifyVariables(variables), context)
        .toPromise()
      if (res.error) throw res.error
      return res.data as TData
    },
    [client],
  )

  return { query, mutate }
}
