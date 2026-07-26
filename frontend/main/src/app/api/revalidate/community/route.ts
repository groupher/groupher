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

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
