import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LANDING_COMMUNITY } from '~/const/name'
import GlobalLayout from '~/providers/GlobalLayout'
import LocaleStoreProvider from '~/stores/locale.domain/provider'
import { CommunityInfoProvider } from '~/stores/provider.landing'
import { ssrThemeInitScript } from '~/utils/ssr/script'
import Main from './Main'

import '~/tailwind/global.css'
import './domain.css'

export const metadata: Metadata = {
  title: 'Groupher | 让你的产品听见用户的声音',
  description: '讨论区、看板、更新日志、帮助文档多合一，收集沉淀用户反馈，助你打造更好的产品。',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <html lang='en' suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: ssrThemeInitScript() }} />
        </head>

        <body>
          <LocaleStoreProvider initData={{ locale: 'en', localeData: JSON.stringify('{}') }}>
            <CommunityInfoProvider initData={LANDING_COMMUNITY}>
              <GlobalLayout mainBlock={Main}>{children}</GlobalLayout>
            </CommunityInfoProvider>
          </LocaleStoreProvider>

          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </Suspense>
  )
}
