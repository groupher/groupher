'use client'

import { type ReactNode, useMemo } from 'react'

import { normalizeFooterLinks, normalizeFooterOnelineLinks } from '~/lib/footerLinks'

import { FooterLinksContext } from './context'
import type { TFooterLinks } from './spec'

type TProps = TFooterLinks & {
  children: ReactNode
}

export default function FooterLinksProvider({ children, layout, links, onelineLinks }: TProps) {
  const value = useMemo<TFooterLinks>(
    () => ({
      layout,
      links: normalizeFooterLinks(links),
      onelineLinks: normalizeFooterOnelineLinks(onelineLinks),
    }),
    [layout, links, onelineLinks],
  )

  return <FooterLinksContext.Provider value={value}>{children}</FooterLinksContext.Provider>
}
