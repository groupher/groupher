import type { TThread } from '~/spec'
import { plural } from '~/fmt'

import { SEARCH_PARAM } from '~/const/url'

import gqClient from './gq_client'

export const query = (schema, variables = {}) => {
  return gqClient
    .query(schema, clarify(variables))
    .toPromise()
    .then((res) => {
      if (res.error) throw res.error
      return res.data
    })
    .catch((e) => {
      throw e
    })
}

export const mutate = (schema, variables) => {
  return gqClient
    .mutation(schema, clarify(variables))
    .toPromise()
    .then((res) => {
      console.log('## got res: ', res)
      if (res.error) {
        // @ts-ignore
        console.log('## error code: ', res.error.graphQLErrors[0].originalError.code)
        throw res.error
      }
      return res.data
    })
    .catch((e) => {
      throw e
    })
}

type TClarifyInput = null | TClarifyObject | TClarifyArray
type TClarifyArray = Array<TClarifyInput>
type TClarifyObject = {
  [key: string]: TClarifyInput
}
// remove __typename if need, avoid GraphQL error
const clarify = (obj: TClarifyInput): TClarifyInput => {
  // NOTE: do not use !obj here, otherwise it will treat 0 as null
  if (obj === null) return null

  if (Array.isArray(obj)) {
    return obj.map(clarify)
  }

  if (typeof obj === 'object') {
    const newObj: TClarifyObject = {}

    for (const key of Object.keys(obj)) {
      newObj[key] = clarify(obj[key])
    }

    // 确保 __typename 存在再删除
    if ('__typename' in newObj) {
      delete newObj.__typename
    }
    return newObj
  }

  return obj
}

/**
 * for client component to fetch  api
 */
export async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, options)
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json()
}

export const fetchArticlePageData = async (community: string, thread: TThread) => {
  return Promise.all([
    fetchAPI(`/${plural(thread)}?${SEARCH_PARAM.COMMUNITY}=${community}`),
    fetchAPI(`/tags?${SEARCH_PARAM.COMMUNITY}=${community}&${SEARCH_PARAM.THREAD}=${thread}`),
  ])
}
