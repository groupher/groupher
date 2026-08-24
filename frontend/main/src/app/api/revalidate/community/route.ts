import { revalidateTag } from 'next/cache'

import { getPhoenixToken } from '~/app/phoenix-token'
import { CACHE_TAG } from '~/const/cache'

type TPayload = {
  community?: string
}

export const POST = async (req: Request) => {
  const payload = (await req.json().catch(() => ({}))) as TPayload
  const community = payload.community?.trim()

  if (!community) {
    return new Response(JSON.stringify({ ok: false, error: 'community is required' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  if (!getPhoenixToken(req)) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  revalidateTag(CACHE_TAG.communityCache(community), 'max')

  const endpoint = process.env.COMMUNITY_REVALIDATION_URL?.trim()
  const secret = process.env.COMMUNITY_REVALIDATE_SECRET?.trim()
  if (endpoint && secret) {
    const communityResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tags: [CACHE_TAG.communityCache(community)],
        reason: 'main.community.update',
      }),
    })
    if (!communityResponse.ok) {
      return new Response(JSON.stringify({ ok: false, error: 'community_purge_failed' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
