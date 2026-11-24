import { describe, expect, it, vi } from 'vitest'

import { resolveReviewAdmission } from './application'
import { GraphQLRequestError } from './graphql'

describe('resolveReviewAdmission', () => {
  it('allows a Global root', async () => {
    await expect(
      resolveReviewAdmission(async () => ({
        currentGlobalPassport: { isRoot: true, permissions: [] },
      })),
    ).resolves.toBe(true)
  })

  it('allows an explicit application reviewer', async () => {
    await expect(
      resolveReviewAdmission(async () => ({
        currentGlobalPassport: {
          isRoot: false,
          permissions: ['COMMUNITY_APPLICATION_REVIEW'],
        },
      })),
    ).resolves.toBe(true)
  })

  it('denies viewers without reviewer facts', async () => {
    await expect(
      resolveReviewAdmission(async () => ({
        currentGlobalPassport: { isRoot: false, permissions: [] },
      })),
    ).resolves.toBe(false)
  })

  it('denies when the current session is invalid', async () => {
    const loadFacts = vi
      .fn()
      .mockRejectedValue(new GraphQLRequestError('Login required.', 'ACCOUNT_LOGIN'))
    await expect(resolveReviewAdmission(loadFacts)).resolves.toBe(false)
    expect(loadFacts).toHaveBeenCalledOnce()
  })
})
