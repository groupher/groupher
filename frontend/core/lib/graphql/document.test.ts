import { parse } from 'graphql'

import { extractQueryName, extractRootResponseKey } from './document'

describe('GraphQL document helpers', () => {
  it('extracts an operation name from a DocumentNode', () => {
    expect(extractQueryName(parse('query CurrentUser { me { login } }'))).toBe('CurrentUser')
  })

  it('uses the root field for an anonymous DocumentNode', () => {
    expect(extractQueryName(parse('{ me { login } }'))).toBe('me')
  })

  it('extracts the root field response key from a named operation', () => {
    expect(extractRootResponseKey('query PagedPosts { pagedPosts { totalCount } }')).toBe(
      'pagedPosts',
    )
  })

  it('prefers a root field alias over the schema field name', () => {
    expect(extractRootResponseKey('query PagedPosts { articles: pagedPosts { totalCount } }')).toBe(
      'articles',
    )
  })
})
