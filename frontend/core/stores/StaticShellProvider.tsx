import type { ReactNode } from 'react'

import { BUILTIN_ALIAS } from '~/const/builtin-alias'
import { INIT_KANBAN_BOARDS, INIT_KANBAN_COLORS } from '~/const/dashboard'
import { LOCALE } from '~/const/i18n'
import {
  AVATAR_LAYOUT,
  BRAND_LAYOUT,
  CHANGELOG_LAYOUT,
  COMMUNITY_LAYOUT,
  INLINE_TAG_LAYOUT,
  KANBAN_CARD_LAYOUT,
  KANBAN_LAYOUT,
  NAV_ACTIVE_LAYOUT,
  POST_LAYOUT,
  TAG_LAYOUT,
} from '~/const/layout'
import METRIC from '~/const/metric'
import { InitialNowProvider } from '~/hooks/useInitialNow'
import type { TCommunity, TLocale } from '~/spec'
import CommunityStoreProvider from '~/stores/community/provider'
import FooterLinksProvider from '~/stores/footerLinks/provider'
import type { TFooterLinks } from '~/stores/footerLinks/spec'
import LocaleStoreProvider from '~/stores/locale/provider'
import ShellStyleProvider from '~/stores/shellStyle/provider'
import ThemeStoreProvider from '~/stores/theme/provider'
import WallpaperStoreProvider from '~/stores/wallpaper/provider'
import type { TInit as TWallpaperInit } from '~/stores/wallpaper/spec'

type TProps = {
  children: ReactNode
  community: TCommunity
  footerLinks: TFooterLinks
  wallpaper?: TWallpaperInit
  locale?: TLocale
  localeData?: string
  initialNow?: number
}

export default function StaticShellProvider({
  children,
  community,
  footerLinks,
  wallpaper,
  locale = LOCALE.EN,
  localeData = '{}',
  initialNow,
}: TProps) {
  return (
    <ThemeStoreProvider>
      <InitialNowProvider initialNow={initialNow}>
        <LocaleStoreProvider initData={{ locale, localeData }}>
          <CommunityStoreProvider initData={community}>
            <ShellStyleProvider
              avatarLayout={AVATAR_LAYOUT.SQUARE}
              brandLayout={BRAND_LAYOUT.BOTH}
              changelogLayout={CHANGELOG_LAYOUT.CLASSIC}
              communityLayout={COMMUNITY_LAYOUT.CLASSIC}
              inlineTagLayout={INLINE_TAG_LAYOUT.BORDER}
              kanbanBgColors={INIT_KANBAN_COLORS}
              kanbanBoards={INIT_KANBAN_BOARDS}
              kanbanCardLayout={KANBAN_CARD_LAYOUT.SIMPLE}
              kanbanLayout={KANBAN_LAYOUT.CLASSIC}
              metric={METRIC.LANDING}
              nameAlias={BUILTIN_ALIAS}
              navActiveLayout={NAV_ACTIVE_LAYOUT.TEXT}
              overlayDark
              postLayout={POST_LAYOUT.QUORA}
              tagLayout={TAG_LAYOUT.HASH}
            >
              <FooterLinksProvider {...footerLinks}>
                <WallpaperStoreProvider initData={wallpaper}>{children}</WallpaperStoreProvider>
              </FooterLinksProvider>
            </ShellStyleProvider>
          </CommunityStoreProvider>
        </LocaleStoreProvider>
      </InitialNowProvider>
    </ThemeStoreProvider>
  )
}
