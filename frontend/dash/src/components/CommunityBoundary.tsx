import type { TCommunityLocale } from '@dash/server/locale'
import type { ReactNode } from 'react'

import type { TCommunity } from '~/spec'
import AccountStoreProvider from '~/stores/account/provider'
import CommunityStoreProvider from '~/stores/community/provider'
import LocaleStoreProvider from '~/stores/locale/provider'

type TProps = {
  children: ReactNode
  community: TCommunity
  locale: TCommunityLocale
}

export default function CommunityBoundary({ children, community, locale }: TProps) {
  return (
    <LocaleStoreProvider initData={locale}>
      <AccountStoreProvider>
        <CommunityStoreProvider initData={community}>{children}</CommunityStoreProvider>
      </AccountStoreProvider>
    </LocaleStoreProvider>
  )
}
