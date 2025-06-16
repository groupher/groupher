import type { NextRequest } from 'next/server'

import { SEARCH_PARAM } from '~/const/url'
import { THREAD } from '~/const/thread'
import { getPagedArticles } from '~/utils/ssr'

export const GET = async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const community = searchParams.get(SEARCH_PARAM.COMMUNITY)

  const data = await getPagedArticles(community, THREAD.POST)

  return Response.json(data)
}
