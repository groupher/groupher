import { DSB_ROUTE } from '~/const/route'

import { resolveMainTab } from './events'

describe('resolveMainTab', () => {
  const dashboardBase = '/acme/dashboard'

  it('resolves valid dashboard tabs with query or hash suffixes', () => {
    expect(resolveMainTab('/acme/dashboard/post/content?tab=latest', dashboardBase)).toBe(
      DSB_ROUTE.POST,
    )
    expect(resolveMainTab('/acme/dashboard/doc/editor#faq', dashboardBase)).toBe(DSB_ROUTE.DOC)
  })

  it('falls back to overview for invalid or external paths', () => {
    expect(resolveMainTab('/acme/dashboard/unknown', dashboardBase)).toBe(DSB_ROUTE.OVERVIEW)
    expect(resolveMainTab('/acme/post', dashboardBase)).toBe(DSB_ROUTE.OVERVIEW)
  })
})
