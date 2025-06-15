import type { NextRequest } from 'next/server'

import { THREAD } from '~/const/thread'
import { getPagedArticles } from '~/utils/ssr'

export const GET = async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const community = searchParams.get('community')

  const data = await getPagedArticles(community, THREAD.CHANGELOG)

  return Response.json(data)
}
