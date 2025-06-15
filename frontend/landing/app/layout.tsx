import { Suspense } from 'react'
import type { Metadata } from 'next'

import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

import type { TRootStoreInit } from '~/stores/spec'

import { HCN } from '~/const/name'
import THEME from '~/const/theme'
import METRIC from '~/const/metric'

import { P } from '~/schemas'
import { gqFetch } from '~/utils/api'

import StoreProvider from '~/stores/provider'
import GlobalLayout from '~/providers/GlobalLayout'

import '../salon/global.css'

export const metadata: Metadata = {
  title: 'Groupher | 让你的产品听见用户的声音',
  description: '讨论区、看板、更新日志、帮助文档多合一，收集沉淀用户反馈，助你打造更好的产品。',
}

const getSSRLandingData = async (): Promise<TRootStoreInit> => {
  // const community = await getCommunity(community$)
  const response = await gqFetch(P.community, { slug: HCN, userHasLogin: false })
  const { data } = await response.json()

  const communityInfo = data

  const { community, dashboard, wallpaper } = communityInfo

  const initState = {
    theme: THEME.LIGHT,
    // locale,
    // localeData,
    articles: {},
    viewing: {
      metric: METRIC.COMMUNITY,
      community,
    },
    wallpaper,
    dashboard,
  }

  return initState
}

const InitDataLoader = async ({ children }) => {
  const initData = await getSSRLandingData()

  return <StoreProvider initData={initData}>{children}</StoreProvider>
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={<h1>...</h1>}>
          {/* @ts-ignore */}
          <InitDataLoader>
            <GlobalLayout>{children}</GlobalLayout>
          </InitDataLoader>
        </Suspense>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
