import { createServerFn } from '@tanstack/react-start'

import type { MentionsGraphFocus } from '~/query/mentionsGraph'

import { fetchGraphQL, setPrivateCacheHeader } from './graphql'

const artimentStatusQuery = `
  query ArtimentStatus($community: String!, $locator: ArtimentStatusInput!) {
    artimentStatus(community: $community, locator: $locator) {
      type status title url
    }
  }
`

type ArtimentStatus = {
  type: MentionsGraphFocus['type']
  status: 'READABLE' | 'UNAVAILABLE' | 'DELETED'
  title: string | null
  url: string | null
}

/** Reads a resource status without depending on MentionsGraph relationships. */
export const loadRestrictedResource = createServerFn({ method: 'GET', strict: false })
  .validator((data: { community: string; focus: MentionsGraphFocus }) => data)
  .handler(async ({ data }) => {
    setPrivateCacheHeader()
    const result = await fetchGraphQL<{ artimentStatus: ArtimentStatus | null }>(
      artimentStatusQuery,
      {
        community: data.community,
        locator: data.focus,
      },
    ).catch(() => null)

    const status = result?.data?.artimentStatus
    return status?.status !== 'READABLE' ? (status ?? null) : null
  })
