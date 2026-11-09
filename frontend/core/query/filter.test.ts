import { describe, expect, it } from 'vitest'

import { toArticlePageFilter } from './filter'

describe('toArticlePageFilter', () => {
  it('omits inactive optional filters from GraphQL variables', () => {
    expect(toArticlePageFilter({ community: 'home', page: 1, size: 20 })).toEqual({
      community: 'home',
    })
  })

  it('serializes active filters after normalization', () => {
    expect(
      toArticlePageFilter({
        community: ' home ',
        communityTag: ' product ',
        communityTags: ['beta', 'alpha', 'beta'],
        cat: 'IDEA',
        status: 'WIP',
        order: 'PUBLISH',
        when: 'THIS_WEEK',
        sort: 'DESC',
      }),
    ).toEqual({
      community: 'home',
      communityTag: 'product',
      communityTags: ['alpha', 'beta'],
      cat: 'IDEA',
      order: 'PUBLISH',
      when: 'THIS_WEEK',
      sort: 'DESC',
    })
  })
})
