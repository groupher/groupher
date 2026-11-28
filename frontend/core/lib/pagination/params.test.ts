import { paginationDefaultV1 } from '@groupher/contracts/pagination'

import {
  pagiConfigKey,
  toEffectivePagiConfig,
  resolvePagiPosition,
  toPagiGraphQLInput,
  toPagiPageInfo,
} from './params'

describe('pagination params adapter', () => {
  it('uses the shared platform default contract', () => {
    expect(paginationDefaultV1).toEqual({
      api: 'offset',
      mode: 'page',
      schemaVersion: 1,
      revision: 0,
      defaultSize: 20,
      maxSize: 100,
    })
  })

  it('maps offset requests without adding cursor fields', () => {
    expect(toPagiGraphQLInput({ api: 'offset', page: 2, size: 20, configRevision: 3 })).toEqual({
      offset: { page: 2, size: 20, configRevision: 3 },
    })
  })

  it('maps forward cursor requests as opaque values', () => {
    expect(
      toPagiGraphQLInput({ api: 'cursor', first: 20, after: 'opaque', configRevision: 4 }),
    ).toEqual({
      cursor: { first: 20, after: 'opaque', configRevision: 4 },
    })
  })

  it('omits absent cursor and revision values instead of serializing undefined', () => {
    expect(toPagiGraphQLInput({ api: 'cursor', first: 20 })).toEqual({ cursor: { first: 20 } })
  })

  it('keeps only config identity in the query-key config segment', () => {
    expect(
      pagiConfigKey({
        api: 'cursor',
        mode: 'INFINITE_SCROLL',
        schemaVersion: 1,
        revision: 7,
        defaultSize: 20,
        maxSize: 100,
      }),
    ).toEqual({ api: 'cursor', mode: 'INFINITE_SCROLL', schemaVersion: 1, revision: 7 })
  })

  it('normalizes GraphQL offset metadata with an explicit API discriminator', () => {
    const pageInfo = {
      __typename: 'OffsetPageInfo' as const,
      page: 2,
      size: 20,
      totalCount: 41,
      totalPages: 3,
      hasPreviousPage: true,
      hasNextPage: true,
    }

    expect(toPagiPageInfo(pageInfo)).toMatchObject({ api: 'offset', page: 2 })
  })

  it('does not invent offset totals for cursor metadata', () => {
    const pageInfo = {
      __typename: 'CursorPageInfo' as const,
      startCursor: 'start',
      endCursor: 'end',
      hasPreviousPage: false,
      hasNextPage: true,
    }

    expect(toPagiPageInfo(pageInfo)).toMatchObject({ api: 'cursor', endCursor: 'end' })
  })
})

it('preserves explicit comment links when administrators switch defaults', () => {
  const config = {
    api: 'cursor' as const,
    mode: 'LOAD_MORE' as const,
    schemaVersion: 1,
    revision: 9,
    defaultSize: 20,
    maxSize: 100,
  }
  expect(
    resolvePagiPosition(config, new URLSearchParams('commentsPage=2'), {
      api: 'commentsApi',
      page: 'commentsPage',
      after: 'commentsAfter',
    }),
  ).toMatchObject({ page: 2, config: { api: 'offset' } })
})

it.each(['PAGE', 'LOAD_MORE', 'INFINITE_SCROLL'] as const)(
  'derives one shared policy for %s',
  (mode) => {
    expect(toEffectivePagiConfig({ pagiMode: mode, pagiRevision: 7 })).toEqual({
      schemaVersion: 1,
      revision: 7,
      defaultSize: 20,
      maxSize: 100,
      mode,
      api: mode === 'PAGE' ? 'offset' : 'cursor',
    })
  },
)

it('resolves separate desktop/mobile defaults', () => {
  const preference = {
    pagiMode: 'PAGE',
    pagiMobileMode: 'INFINITE_SCROLL',
    pagiRevision: 7,
  } as const
  const mobile = toEffectivePagiConfig(preference, true)
  expect(toEffectivePagiConfig(undefined, true)).toMatchObject({
    api: 'cursor',
    mode: 'INFINITE_SCROLL',
  })
  expect(mobile).toMatchObject({ api: 'cursor', mode: 'INFINITE_SCROLL', revision: 7 })
})
