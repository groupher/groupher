import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import { docMarkdownProxy } from './doc-markdown'

describe('docMarkdownProxy', () => {
  it('rewrites a public doc .md URL to the markdown route', () => {
    const request = new NextRequest('https://example.com/groupher/doc/42/getting-started.md')

    const response = docMarkdownProxy(request)

    expect(response?.headers.get('x-middleware-rewrite')).toBe(
      'https://example.com/api/docs/groupher/42/markdown',
    )
  })

  it('ignores the regular doc page URL', () => {
    const request = new NextRequest('https://example.com/groupher/doc/42/getting-started')

    expect(docMarkdownProxy(request)).toBeNull()
  })
})
