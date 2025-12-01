import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { GlobalLayout, GraphQLProvider, getSSRInitData, parseRouteInfo } from '~/providers'
import StoreProvider from '~/stores/provider'
import { deepSanitize } from '~/utils/fmt'
import { ssrThemeInitScript } from '~/utils/ssr/script'

// import { Analytics } from '@vercel/analytics/react'
// import { SpeedInsights } from '@vercel/speed-insights/next'

import '~/tailwind/global.css'

export const metadata: Metadata = {
  title: 'Groupher | 让你的产品听见用户的声音',
  description: '讨论区、看板、更新日志、帮助文档多合一，收集沉淀用户反馈，助你打造更好的产品。',
}

const StoreInitLoader = async ({ children }) => {
  const headersList = await headers()
  const routeInfo = headersList.get('x-route')
  if (!routeInfo) return redirect('/404')

  const urlInfo = parseRouteInfo(routeInfo)
  const initData = await getSSRInitData(urlInfo)

  console.log('## [layout.tsx] initData:', initData.viewing.metric)
  return <StoreProvider initData={deepSanitize(initData)}>{children}</StoreProvider>
}

export default function Layout({ children }) {
  return (
    <html lang='en'>
      <head>
        <script dangerouslySetInnerHTML={{ __html: ssrThemeInitScript() }} />
      </head>

      <body>
        <GraphQLProvider>
          <Suspense fallback={<h1>...</h1>}>
            {/* @ts-ignore */}
            <StoreInitLoader>
              <GlobalLayout>{children}</GlobalLayout>
            </StoreInitLoader>
          </Suspense>
        </GraphQLProvider>
      </body>
    </html>
  )
}
