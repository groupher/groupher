import { mergeRight, toUpper, clone } from 'ramda'
import { createClient, cacheExchange, fetchExchange } from '@urql/core'

import BStore from '~/utils/bstore'

import { GRAPHQL_ENDPOINT, PAGE_SIZE } from '~/config'
import { isString } from './validator'

// for client(widget most) only
export const buildGQClient = (): ReturnType<typeof makeGQClient> => {
  return makeGQClient(BStore.get('token'))
}

// NOTE the client with jwt info is used for getInitialProps for SSR
// to load user related data
export const makeGQClient = (token: string): ReturnType<typeof createClient> => {
  const client = createClient({
    url: GRAPHQL_ENDPOINT,
    exchanges: [cacheExchange, fetchExchange],
    fetchOptions: () => ({
      headers: { authorization: token ? `Bearer ${token}` : '' },
    }),
  })

  // see https://formidable.com/open-source/urql/docs/basics/core/
  return client
}

export const makeGithubExplore = (
  GRAPHQL_ENDPOINT: string,
  token: string,
): ReturnType<typeof createClient> => {
  const client = createClient({
    url: GRAPHQL_ENDPOINT,
    exchanges: [cacheExchange, fetchExchange],
    fetchOptions: {
      headers: {
        authorization: token ? `Bearer ${token}` : '',
      },
    },
  })

  return client
}

export const pagiFilter = (
  page: number,
  options: Record<string, string | number> = {},
): Record<string, any> => mergeRight({ page, size: PAGE_SIZE.D }, options)

/*
 * map value(string) to UPPER case for server absinthe-atom format
 * e.p: is server required :post, front-end should pass "POST"
 */
export const atomizeValues = (_obj: Record<string, string>): Record<string, string> => {
  const obj = clone(_obj)

  for (const k in obj) {
    if (isString(obj[k])) {
      obj[k] = toUpper(obj[k])
    }
  }

  return obj
}

// NOTE: this is a simple hack for send parallel requests in rxjs
// in rxjs, if you want to send parallel request you should use complex method
// like forkJoin .. which need to refactor whole sr71 part
// currently the simple later is fine
export const later = (func, time = 200): ReturnType<typeof setTimeout> => {
  return setTimeout(func, time)
}

const normalizeGQLQuery = (query: string): string => {
  query = query.replace(/#.*?(\n|$)/g, '')
  query = query.replace(/"""[\s\S]*?"""/g, '')
  query = query.replace(/\s+/g, ' ').trim()
  query = query.replace(/^(query|mutation|subscription)(?=[^\s])/, '$1 ')

  return query
}

export const extractQueryName = (schema: string): string | null => {
  const normalized = normalizeGQLQuery(schema)

  const namedQueryRegex = /^(query|mutation|subscription)\s+(\w+)\s*(?:\(|\{)/
  const namedMatch = normalized.match(namedQueryRegex)
  if (namedMatch) return namedMatch[2]

  const anonymousRegex = /^(query|mutation|subscription)\s*(?:\([^)]*\))?\s*\{\s*(\w+)/
  const anonymousMatch = normalized.match(anonymousRegex)
  if (anonymousMatch) return anonymousMatch[2]

  return null
}
