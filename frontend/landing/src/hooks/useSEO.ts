import { pick } from 'ramda'

import type { TDashboardSEOConfig } from '~/spec'
import { SEO_KEYS } from '~/const/seo'

import useSubStore from '~/hooks/useSubStore'

export default (): TDashboardSEOConfig => {
  const store = useSubStore('dashboard')

  return pick(SEO_KEYS, store)
}
