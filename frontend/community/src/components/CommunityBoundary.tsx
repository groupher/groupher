import type { TCommunityLocale } from '@community/server/locale'
import { useSuspenseQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import type { TThemeSeed } from '~/lib/ssr/script'
import { Q } from '~/query'
import CommunityShellProvider from '~/stores/CommunityShellProvider'

export default function CommunityBoundary({
  children,
  community,
  locale,
  initialNow,
  theme,
}: {
  children: ReactNode
  community: string
  locale: TCommunityLocale
  initialNow: number
  theme: TThemeSeed
}) {
  const { data: communityConfig } = useSuspenseQuery(Q.community.slug(community))
  const { data: dashboard } = useSuspenseQuery(Q.dsb.slug(community))
  const { data: wallpaper } = useSuspenseQuery(Q.wallpaper.slug(community))

  return (
    <CommunityShellProvider
      initData={{
        community: communityConfig,
        dashboard,
        theme,
        wallpaper,
      }}
      locale={locale.locale}
      localeData={locale.localeData}
      initialNow={initialNow}
    >
      {children}
    </CommunityShellProvider>
  )
}
