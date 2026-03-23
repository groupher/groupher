import { GRAPHQL_ENDPOINT } from '~/config'

export const gqFetch = async (query, variables) => {
  return await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  })
}
