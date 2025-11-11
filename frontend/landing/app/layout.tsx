import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LANDING_SSR_INFO } from '~/providers/constant'
import GlobalLayout from '~/providers/GlobalLayout'
import StoreProvider from '~/stores/provider'

import '~/tailwind/global.css'

import Main from './Main'

export const metadata: Metadata = {
  title: 'Groupher | 让你的产品听见用户的声音',
  description: '讨论区、看板、更新日志、帮助文档多合一，收集沉淀用户反馈，助你打造更好的产品。',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <body>
        <Suspense fallback={<h3>loading...</h3>}>
          <StoreProvider initData={LANDING_SSR_INFO}>
            <GlobalLayout mainBlock={Main}>{children}</GlobalLayout>
          </StoreProvider>
        </Suspense>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
