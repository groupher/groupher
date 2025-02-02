import { Client, cacheExchange, fetchExchange } from '@urql/core'

/* import { onError } from 'apollo-link-error' */

import { GRAPHQL_ENDPOINT } from '~/config'
import OAUTH from '~/const/oauth'

import BStore from '../bstore'

// see setup https://formidable.com/open-source/urql/docs/basics/core/
const client = new Client({
  url: GRAPHQL_ENDPOINT,
  fetchOptions: () => {
    // console.log('## ## gq client init: ', BStore.get('token'))
    const authorization = `Bearer ${BStore.get(OAUTH.TOKEN_KEY) || ''}`

    return {
      headers: {
        special: 'Special header value',
        authorization,
      },
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
