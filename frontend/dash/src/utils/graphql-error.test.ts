import { describe, expect, it } from 'vitest'

import {
  readGraphQLErrorCode,
  readGraphQLErrorMessage,
  serializeGraphQLError,
} from './graphql-error'

describe('GraphQL route error serialization', () => {
  it('prefers a custom code while the Error instance is intact', () => {
    const error = Object.assign(new Error('Access expired.'), { code: 'TOKEN_EXPIRED' })

    expect(readGraphQLErrorCode(error)).toBe('TOKEN_EXPIRED')
  })

  it('recovers the code from the standard message field after SSR serialization', () => {
    const message = serializeGraphQLError('Access expired.', 'TOKEN_EXPIRED')

    expect(readGraphQLErrorCode(new Error(message))).toBe('TOKEN_EXPIRED')
  })

  it('does not infer a code from arbitrary error text', () => {
    expect(readGraphQLErrorCode(new Error('Request failed: TOKEN_EXPIRED'))).toBeUndefined()
  })

  it('keeps the transport marker out of the user-facing message', () => {
    const message = serializeGraphQLError('Access expired.', 'TOKEN_EXPIRED')

    expect(readGraphQLErrorMessage(message)).toBe('Access expired.')
  })
})
