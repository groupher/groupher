import { useContext } from 'react'

import { FooterLinksContext } from '~/stores/footerLinks/context'
import type { TFooterLinks } from '~/stores/footerLinks/spec'

/** Exposes footer links state and actions through the shared React hook boundary. */
export default function useFooterLinks(): TFooterLinks {
  const value = useContext(FooterLinksContext)
  if (!value) throw new Error('useFooterLinks must be used within FooterLinksProvider')

  return value
}
