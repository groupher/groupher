import type { NextRequest } from 'next/server'

import { THREAD } from '~/const/thread'
import { getPagedArticlesParams } from '~/lib/pagedArticlesFilter'
import { getPagedArticles } from '~/utils/ssr'

export const GET = async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const community = searchParams.get('community') || ''
  const filter = getPagedArticlesParams(community, searchParams)

  const data = await getPagedArticles(community, THREAD.CHANGELOG, filter)

  return Response.json(data)
}
