import { DSB_ROUTE } from '~/const/route'

import { resolveMainTab } from './events'

describe('resolveMainTab', () => {
  const dashboardBase = '/acme'

  it('resolves valid dashboard tabs with query or hash suffixes', () => {
    expect(resolveMainTab('/acme/post/content?tab=latest', dashboardBase)).toBe(DSB_ROUTE.POST)
    expect(resolveMainTab('/acme/doc/editor#faq', dashboardBase)).toBe(DSB_ROUTE.DOC)
  })

  it('falls back to overview for invalid or external paths', () => {
    expect(resolveMainTab('/acme/unknown', dashboardBase)).toBe(DSB_ROUTE.OVERVIEW)
    expect(resolveMainTab('/acme/not-real', dashboardBase)).toBe(DSB_ROUTE.OVERVIEW)
  })
})
