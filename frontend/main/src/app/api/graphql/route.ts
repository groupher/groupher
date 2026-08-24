import { revalidateTag } from 'next/cache'

import { proxyGraphQLRequest } from '~/graphql/proxy'
import { mutationCacheTags } from '~/query/cacheInvalidation'

export const GET = (request: Request) => proxyGraphQLRequest(request)
export const POST = async (request: Request) => {
  const payload = (await request
    .clone()
    .json()
    .catch(() => null)) as { query?: unknown; variables?: unknown } | null
  const response = await proxyGraphQLRequest(request)

  if (response.ok && payload && typeof payload.query === 'string') {
    const result = (await response
      .clone()
      .json()
      .catch(() => null)) as { errors?: unknown[] } | null
    if (!result?.errors?.length) {
      const variables =
        payload.variables && typeof payload.variables === 'object'
          ? (payload.variables as Record<string, unknown>)
          : {}
      for (const tag of mutationCacheTags(payload.query, variables)) revalidateTag(tag, 'max')
    }
  }

  return response
}
