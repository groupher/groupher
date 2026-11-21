import { pressKeys } from '../press'
import type { TQueryInvalidationPlan, TQueryInvalidationTarget } from './types'

const exact = (key: readonly unknown[]) => (queryKey: readonly unknown[]) =>
  key.length === queryKey.length && key.every((part, index) => queryKey[index] === part)

/** Invalidates the Press configuration query for a community. */
export const slug = (community: string): TQueryInvalidationTarget => ({
  domain: 'press',
  target: 'slug',
  community,
})

/** Resolves a Press invalidation target into query-key matchers. */
export const resolve = (target: TQueryInvalidationTarget): TQueryInvalidationPlan => {
  if (target.domain !== 'press') return { matches: [], refetch: 'active' }

  return {
    matches: [
      {
        domain: target.domain,
        target: target.target,
        matches: exact(pressKeys.slug(target.community)),
      },
    ],
    refetch: 'active',
  }
}
