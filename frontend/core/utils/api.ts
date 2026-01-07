import { GRAPHQL_ENDPOINT } from '~/config'

type TClarifyInput = null | TClarifyObject | TClarifyArray
type TClarifyArray = Array<TClarifyInput>
type TClarifyObject = {
  [key: string]: TClarifyInput
}

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

/**
 * for client component to fetch  api
 */
export async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  console.log('## fetchAPI: ', path)

  const normalized = path.startsWith('/') ? path.slice(1) : path
  const res = await fetch(`/api/${normalized}`, options)

  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(`Request failed ${res.status}: ${msg}`)
  }
  return res.json() as Promise<T>
}
