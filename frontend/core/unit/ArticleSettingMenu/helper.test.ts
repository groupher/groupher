import { describe, expect, it } from 'vitest'

import { GraphQLRequestError } from '~/graphql/client'

import { isWorkingCopyRevisionConflict } from './helper'

const requestError = (code: string | number) =>
  new GraphQLRequestError(Response.json({}), [{ extensions: { code } }])

describe('isWorkingCopyRevisionConflict', () => {
  it('recognizes the canonical WorkingCopy conflict code', () => {
    expect(isWorkingCopyRevisionConflict(requestError(4561))).toBe(true)
  })

  it('does not classify other GraphQL failures as revision conflicts', () => {
    expect(isWorkingCopyRevisionConflict(requestError('forbidden'))).toBe(false)
    expect(isWorkingCopyRevisionConflict(new Error('request failed'))).toBe(false)
  })
})
