import { communityQueries } from '@community/query/queries'
import type { TCommunityLocale } from '@community/server/locale'
import { useSuspenseQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import MainProvider from '~/stores/provider'

export default function CommunityBoundary({
  children,
  community,
  locale,
  initialNow,
}: {
  children: ReactNode
  community: string
  locale: TCommunityLocale
  initialNow: number
}) {
  const { data: shell } = useSuspenseQuery(communityQueries.shell(community))

  return (
    <MainProvider
      initData={{
        account: shell.account,
        community: shell.community,
        dashboard: shell.dashboard,
        wallpaper: shell.wallpaper,
      }}
      locale={locale.locale}
      localeData={locale.localeData}
      initialNow={initialNow}
    >
      {children}
    </MainProvider>
  )
}
