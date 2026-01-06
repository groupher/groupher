import { Client, cacheExchange, fetchExchange } from '@urql/core'

/* import { onError } from 'apollo-link-error' */
import { GRAPHQL_ENDPOINT } from '~/config'

// see setup https://formidable.com/open-source/urql/docs/basics/core/
const client = new Client({
  url: GRAPHQL_ENDPOINT,
  fetchOptions: () => {
    return {
      headers: {
        special: 'Special header value',
      },
      // make sure cookie is included
      // since groupher.com and api.groupher.com is different domain
      // same for dev env: localhost:3000 and localhost:4001
      credentials: 'include',
    }
  },
  // the default:
  exchanges: [cacheExchange, fetchExchange],
  // requestPolicy: 'network-only',
  // see https://formidable.com/open-source/urql/docs/basics/document-caching/#request-policies
  requestPolicy: 'cache-and-network',
  // the same as:
  // exchanges: [dedupExchange, cacheExchange, fetchExchange],
})

export default client
