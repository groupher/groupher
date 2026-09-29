import { AUTH_ERROR } from '@groupher/contracts/auth'
import { describe, expect, it } from 'vitest'

import {
  readGraphQLErrorCode,
  readGraphQLErrorMessage,
  serializeGraphQLError,
} from './graphql-error'

describe('GraphQL route error serialization', () => {
  it('prefers a custom code while the Error instance is intact', () => {
    const error = Object.assign(new Error('Access expired.'), { code: AUTH_ERROR.TOKEN_EXPIRED })

    expect(readGraphQLErrorCode(error)).toBe(AUTH_ERROR.TOKEN_EXPIRED)
  })

  it('recovers the code from the standard message field after SSR serialization', () => {
    const message = serializeGraphQLError('Access expired.', AUTH_ERROR.TOKEN_EXPIRED)

    expect(readGraphQLErrorCode(new Error(message))).toBe(AUTH_ERROR.TOKEN_EXPIRED)
  })

  it('accepts an exact machine-code message from a hydrated route error', () => {
    expect(readGraphQLErrorCode(new Error(AUTH_ERROR.TOKEN_MISSING))).toBe(AUTH_ERROR.TOKEN_MISSING)
  })

  it('does not infer a code from arbitrary error text', () => {
    expect(readGraphQLErrorCode(new Error('Request failed: TOKEN_EXPIRED'))).toBeUndefined()
  })

  it('keeps the transport marker out of the user-facing message', () => {
    const message = serializeGraphQLError('Access expired.', AUTH_ERROR.TOKEN_EXPIRED)

    expect(readGraphQLErrorMessage(message)).toBe('Access expired.')
  })
})
