/**
 * Verifies public entrypoint isolation and fail-closed behavior.
 *
 * Business position:
 *
 *   Service Binding request
 *     -> private-path rejection
 *     -> public output policy
 */

import { describe, expect, it } from 'vitest'

import { publicEntryDecision } from './public-entry-guard'

describe('publicEntryDecision', () => {
  it('always hides health and internal routes from the named entrypoint', () => {
    for (const disabled of ['false', 'true', undefined, 'invalid']) {
      expect(publicEntryDecision('/health', disabled)).toBe('not-found')
      expect(publicEntryDecision('/internal/invalidate', disabled)).toBe('not-found')
    }
  })

  it('allows public routes only when explicitly enabled', () => {
    expect(publicEntryDecision('/home/post/1.md', 'false')).toBe('allow')
    expect(publicEntryDecision('/home/post/1.md', 'true')).toBe('disabled')
    expect(publicEntryDecision('/home/post/1.md', undefined)).toBe('disabled')
    expect(publicEntryDecision('/home/post/1.md', 'invalid')).toBe('disabled')
  })
})
