import { pick } from 'ramda'
import { SEO_KEYS } from '~/const/seo'
import useDashboard from '~/hooks/useDashboard'
import type { TDsdSEOConf } from '~/spec'

export default (): TDsdSEOConf => {
  const store = useDashboard()

  return pick(SEO_KEYS, store)
}
