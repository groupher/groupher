import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

import { GlobalLayout, GraphQLProvider, getSSRInitData, parseRouteInfo } from '~/providers'
import StoreProvider from '~/stores/provider'

// import { Analytics } from '@vercel/analytics/react'
// import { SpeedInsights } from '@vercel/speed-insights/next'

import '../salon/global.css'

export const metadata: Metadata = {
  title: 'Groupher | 让你的产品听见用户的声音',
  description: '讨论区、看板、更新日志、帮助文档多合一，收集沉淀用户反馈，助你打造更好的产品。',
}

function deepSanitize(obj: any): any {
  return JSON.parse(JSON.stringify(obj)) // 最彻底的净化方式
}

const InitDataLoader = async ({ children }) => {
  const headersList = await headers()
  const routeInfo = headersList.get('x-route')
  if (!routeInfo) return redirect('/404')
  const urlInfo = parseRouteInfo(routeInfo)

  const initData = await getSSRInitData(urlInfo)

  return (
    <GraphQLProvider>
      <StoreProvider initData={deepSanitize(initData)}>{children}</StoreProvider>
    </GraphQLProvider>
  )
}

export default async function Layout({ children }) {
  return (
    <html lang='en'>
      <body>
        <Suspense fallback={<h1>...</h1>}>
          {/* @ts-ignore */}
          <InitDataLoader>
            <GlobalLayout>{children}</GlobalLayout>
          </InitDataLoader>
        </Suspense>
      </body>
    </html>
  )
}
