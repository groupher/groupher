import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Suspense } from 'react'
import { GlobalLayout, GraphQLProvider, getSSRInitData, parseRouteInfo } from '~/providers'
import StoreProvider from '~/stores/provider'
import { deepSanitize } from '~/utils/fmt'

import '~/tailwind/global.css'
import './domain.css'

export const metadata: Metadata = {
  title: 'Groupher | 让你的产品听见用户的声音',
  description: '讨论区、看板、更新日志、帮助文档多合一，收集沉淀用户反馈，助你打造更好的产品。',
}

const StoreInitLoader = async ({ children }) => {
  const headersList = await headers()
  const routeInfo = headersList.get('x-route')
  const urlInfo = parseRouteInfo(routeInfo)
  const initData = await getSSRInitData(urlInfo)

  return <StoreProvider initData={deepSanitize(initData)}>{children}</StoreProvider>
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <body>
        <GraphQLProvider>
          <Suspense fallback={<h1>dashboard loading...</h1>}>
            {/* @ts-ignore */}
            <StoreInitLoader>
              <GlobalLayout>{children}</GlobalLayout>
            </StoreInitLoader>
          </Suspense>
        </GraphQLProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
