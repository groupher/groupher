import type { ResultOf } from '@graphql-typed-document-node/core'

import { browserGraphQLRequest } from '~/graphql/client'
import { community as communityDocument } from '~/schemas/pages/community'
import type { TCommunity } from '~/spec'

const inFlight = new Map<string, Promise<TCommunity>>()

/** Coalesces concurrent domain refetches without retaining another confirmed cache. */
export const fetchCommunity = (community: string): Promise<TCommunity> => {
  const existing = inFlight.get(community)
  if (existing) return existing

  const request = browserGraphQLRequest<ResultOf<typeof communityDocument>>(communityDocument, {
    slug: community,
    userHasLogin: false,
  })
    .then((data) => {
      const value = data.community as unknown as TCommunity | null
      if (!value) throw new Error(`Community '${community}' was not found.`)
      return value
    })
    .finally(() => inFlight.delete(community))

  inFlight.set(community, request)
  return request
}
