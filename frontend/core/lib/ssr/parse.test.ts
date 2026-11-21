import type { TCommunity } from '~/spec'

import { parseDashboard } from './parse'

it('bootstraps both layout defaults when dashboard data is absent', () => {
  expect(parseDashboard({} as TCommunity)).toMatchObject({
    pagiMode: 'PAGE',
    pagiMobileMode: 'INFINITE_SCROLL',
    pagiRevision: 0,
    contentShadow: false,
  })
  expect(parseDashboard({} as TCommunity)).not.toHaveProperty('original')
})

it('normalizes both GraphQL preferences without losing the revision', () => {
  expect(
    parseDashboard({
      dashboard: { pagiMode: 'LOAD_MORE', pagiMobileMode: 'PAGE', pagiRevision: 7 },
    } as unknown as TCommunity),
  ).toMatchObject({
    pagiMode: 'LOAD_MORE',
    pagiMobileMode: 'PAGE',
    pagiRevision: 7,
  })
  expect(
    parseDashboard({
      dashboard: { pagiMode: 'LOAD_MORE', pagiMobileMode: 'PAGE', pagiRevision: 7 },
    } as unknown as TCommunity),
  ).not.toHaveProperty('original')
})
