import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import { queryWhitelistProxy } from './query-whitelist'

const request = (url: string) => new NextRequest(url)

describe('queryWhitelistProxy', () => {
  it('keeps oauth callback query params untouched', () => {
    const response = queryWhitelistProxy(
      request('http://localhost/api/auth/callback/github?code=abc&state=xyz'),
    )

    expect(response.headers.get('x-middleware-rewrite')).toBeNull()
  })

  it('rewrites page requests with unknown query params', () => {
    const response = queryWhitelistProxy(request('http://localhost/cper/dashboard?code=abc&page=2'))

    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'http://localhost/cper/dashboard?page=2',
    )
  })

  it('does not skip dotted page pathnames', () => {
    const response = queryWhitelistProxy(request('http://localhost/profile/john.doe?page=2&x=1'))

    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'http://localhost/profile/john.doe?page=2',
    )
  })
})
