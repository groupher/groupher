import type { NextRequest } from 'next/server'

import { SEARCH_PARAM } from '~/const/url'
import type { TThread } from '~/spec'
import { getPagedTags } from '~/utils/ssr'

export const GET = async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const community = searchParams.get(SEARCH_PARAM.COMMUNITY)
  const thread = searchParams.get(SEARCH_PARAM.THREAD)

  const data = await getPagedTags(community, thread as TThread)

  return Response.json(data.entries)
}
