import { pick } from 'ramda'

import { SEO_KEYS } from '~/const/seo'
import type { TDsdSEOConf } from '~/spec'
import useDsb from '~/stores/dsb/hooks'

/** Exposes seo state and actions through the shared React hook boundary. */
export default function useSEO(): TDsdSEOConf {
  const dsb$ = useDsb()

  return pick(SEO_KEYS, dsb$)
}
