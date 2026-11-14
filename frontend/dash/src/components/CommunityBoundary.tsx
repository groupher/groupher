import type { TCommunityLocale } from '@dash/server/locale'
import { useSuspenseQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { Q } from '~/query'
import AccountStoreProvider from '~/stores/account/provider'
import type { TInit as TAccountInit } from '~/stores/account/spec'
import CommunityStoreProvider from '~/stores/community/provider'
import LocaleStoreProvider from '~/stores/locale/provider'

import DashAccountBoundary from './DashAccountBoundary'

type TProps = {
  children: ReactNode
  community: string
  account: TAccountInit
  locale: TCommunityLocale
}

export default function CommunityBoundary({ children, account, community, locale }: TProps) {
  const { data: communityConfig } = useSuspenseQuery(Q.community.slug(community))

  return (
    <LocaleStoreProvider initData={locale}>
      <AccountStoreProvider initData={account}>
        <DashAccountBoundary>
          <CommunityStoreProvider initData={communityConfig}>{children}</CommunityStoreProvider>
        </DashAccountBoundary>
      </AccountStoreProvider>
    </LocaleStoreProvider>
  )
}
