'use client'

import type { ReactNode } from 'react'

import useDashboard from '~/stores/dashboard/hooks'

import FooterLinksProvider from './provider'

export default function DsbFooterLinksProvider({ children }: { children: ReactNode }) {
  const { footerLayout, footerLinks, footerOnelineLinks } = useDashboard()

  return (
    <FooterLinksProvider
      layout={footerLayout}
      links={footerLinks}
      onelineLinks={footerOnelineLinks}
    >
      {children}
    </FooterLinksProvider>
  )
}
