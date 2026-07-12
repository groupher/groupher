import { getDoc } from '~/app/ssr'

type TContext = {
  params: Promise<{
    community: string
    id: string
  }>
}

export async function GET(_request: Request, { params }: TContext): Promise<Response> {
  const { community, id } = await params
  const doc = await getDoc(community, id)

  if (!doc) {
    return new Response('Not Found', { status: 404 })
  }

  return new Response(doc.document?.markdown ?? '', {
    headers: {
      'Content-Disposition': 'inline',
      'Content-Type': 'text/markdown; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
