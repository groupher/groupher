import { getToken } from 'next-auth/jwt'
import { revalidateTag } from 'next/cache'

import { CACHE_TAG } from '~/const/cache'
import { AUTH_KEY } from '~/const/oauth'

type TPayload = {
  community?: string
}

export const POST = async (req: Request) => {
  const payload = (await req.json().catch(() => ({}))) as TPayload
  const community = payload.community?.trim()
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    raw: false,
  })

  if (!community) {
    return new Response(JSON.stringify({ ok: false, error: 'community is required' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  if (!token?.[AUTH_KEY.TOKEN]) {
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
