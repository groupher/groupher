import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import type { TCommunity } from '~/spec'

import { communityKeys, patchCommunity, pickCommunityFields } from './community'

describe('community confirmed owner', () => {
  it('drops dashboard and viewer fields from the canonical public Query value', () => {
    const projected = pickCommunityFields({
      slug: 'home',
      title: 'Home',
      dashboard: { baseInfo: { title: 'duplicate' } },
      viewerHasSubscribed: true,
    } as TCommunity)

    expect(projected).toEqual({ slug: 'home', title: 'Home' })
  })

  it('patches the canonical Query key instead of mutating its Valtio projection', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(communityKeys.slug('home'), { slug: 'home', title: 'Before' })

    patchCommunity(queryClient, 'home', { title: 'After' })

    expect(queryClient.getQueryData(communityKeys.slug('home'))).toEqual({
      slug: 'home',
      title: 'After',
    })
  })
})
