import { pick } from 'ramda'
import { SEO_KEYS } from '~/const/seo'
import useDashboard from '~/hooks/useDashboard'
import type { TDashboardSEOConfig } from '~/spec'

export default (): TDashboardSEOConfig => {
  const store = useDashboard()

  // @ts-expect-error
  return pick(SEO_KEYS, store)
}
