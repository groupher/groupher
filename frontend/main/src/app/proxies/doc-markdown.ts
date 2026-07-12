import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const DOC_MARKDOWN_PATH = /^\/([^/]+)\/doc\/([^/]+)\/[^/]+\.md$/

export function docMarkdownProxy(request: NextRequest): NextResponse | null {
  const match = request.nextUrl.pathname.match(DOC_MARKDOWN_PATH)
  if (!match) return null

  const [, community, id] = match
  const url = request.nextUrl.clone()
  url.pathname = `/api/docs/${community}/${id}/markdown`

  return NextResponse.rewrite(url)
}
