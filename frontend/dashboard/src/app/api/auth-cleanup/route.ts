import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

/**
 * remove next-auth's session token to save cookie space
 * we use our own token which return in next-auth's signIn callback
 */
export async function POST(_req: NextRequest) {
  const cookies$ = await cookies()

  const result = {
    message: 'removed',
  }

  cookies$.delete('authjs.session-token')

  return NextResponse.json(result, {
    status: 200,
  })
}
