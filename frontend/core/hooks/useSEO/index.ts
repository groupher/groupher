import { pick } from 'ramda'

import { SEO_KEYS } from '~/const/seo'
import type { TDsdSEOConf } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

export default function useSEO(): TDsdSEOConf {
  const dsb$ = useDashboard()

  return pick(SEO_KEYS, dsb$)
}
