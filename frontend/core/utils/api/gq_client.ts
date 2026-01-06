import { Client, cacheExchange, fetchExchange } from '@urql/core'

/* import { onError } from 'apollo-link-error' */
import { GRAPHQL_ENDPOINT } from '~/config'
import { FETCH_OPTIONS } from '~/utils/graphql'

// see setup https://formidable.com/open-source/urql/docs/basics/core/
const client = new Client({
  url: GRAPHQL_ENDPOINT,
  fetchOptions: FETCH_OPTIONS,
  // the default:
  exchanges: [cacheExchange, fetchExchange],
  // the same as:
  // exchanges: [dedupExchange, cacheExchange, fetchExchange],
})

export default client
