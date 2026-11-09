import type { ReactNode } from 'react'

import AccountStoreProvider from '~/stores/account/provider'

import DashAccountBoundary from './DashAccountBoundary'

/** Supplies the formal account session to review routes outside a Community shell. */
export default function PlatformReviewBoundary({ children }: { children: ReactNode }) {
  return (
    <AccountStoreProvider>
      <DashAccountBoundary>{children}</DashAccountBoundary>
    </AccountStoreProvider>
  )
}
