'use client'

import type { AnyVariables, DocumentInput } from '@urql/core'
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

export default function useGraphQL() {
  const client = useClient()

  const query = async <TData, TVars extends AnyVariables = AnyVariables>(
    schema: DocumentInput<TData, TVars>,
    variables?: TVars,
  ) => {
    const res = await client
      .query<TData, TVars>(schema, clarify(variables ?? {}) as TVars)
      .toPromise()
    if (res.error) throw res.error
    return res.data as TData
  }

  const mutate = async <TData, TVars extends AnyVariables = AnyVariables>(
    schema: DocumentInput<TData, TVars>,
    variables?: TVars,
  ) => {
    const res = await client
      .mutation<TData, TVars>(schema, clarify(variables ?? {}) as TVars)
      .toPromise()
    if (res.error) throw res.error
    return res.data as TData
  }

  return { query, mutate }
}
