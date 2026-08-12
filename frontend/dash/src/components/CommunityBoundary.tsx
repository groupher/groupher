import type { TCommunityLocale } from '@dash/server/locale'
import type { ReactNode } from 'react'

import type { TCommunity } from '~/spec'
import AccountStoreProvider from '~/stores/account/provider'
import type { TInit as TAccountInit } from '~/stores/account/spec'
import CommunityStoreProvider from '~/stores/community/provider'
import LocaleStoreProvider from '~/stores/locale/provider'

type TProps = {
  children: ReactNode
  community: TCommunity
  account: TAccountInit
  locale: TCommunityLocale
}

export default function CommunityBoundary({ children, account, community, locale }: TProps) {
  return (
    <LocaleStoreProvider initData={locale}>
      <AccountStoreProvider initData={account}>
        <CommunityStoreProvider initData={community}>{children}</CommunityStoreProvider>
      </AccountStoreProvider>
    </LocaleStoreProvider>
  )
}
