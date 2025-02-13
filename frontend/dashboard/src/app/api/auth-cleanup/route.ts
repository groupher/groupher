import { NextResponse, NextRequest } from 'next/server'
import { cookies } from 'next/headers'

/**
 * remove next-auth's session token to save cookie space
 * we use our own token which return in next-auth's signIn callback
 */
export async function POST(req: NextRequest) {
  const result = {
    message: 'removed',
  }

  cookies().delete('authjs.session-token')

  return NextResponse.json(result, {
    status: 200,
  })
}
