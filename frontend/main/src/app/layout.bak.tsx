import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
// import { Suspense } from 'react'
import { GlobalLayout, GraphQLProvider, getSSRInitData, parseRouteInfo } from '~/providers'
import StoreProvider from '~/stores/provider'
import { ZustandStoreProvider } from '~/stores/zustand'
import { deepSanitize } from '~/utils/fmt'
import { ssrThemeInitScript } from '~/utils/ssr/script'

import Tmp from './tmp'
import '~/tailwind/global.css'

export const metadata: Metadata = {
  title: 'Groupher | 让你的产品听见用户的声音',
  description: '讨论区、看板、更新日志、帮助文档多合一，收集沉淀用户反馈，助你打造更好的产品。',
}

// StoreInitLoader 负责获取数据和注入脚本，并且在服务器端提供 Context
const StoreInitLoader = async ({ children }) => {
  const headersList = await headers()
  const routeInfo = headersList.get('x-route')
  if (!routeInfo) return redirect('/404')

  const urlInfo = parseRouteInfo(routeInfo)
  const initData = await getSSRInitData(urlInfo)
  const sanitizedData = deepSanitize(initData)

  return (
    <StoreProvider initData={sanitizedData}>
      <ZustandStoreProvider initData={sanitizedData}>
        <Tmp />
      </ZustandStoreProvider>
      {children}
    </StoreProvider>
  )
}

export default async function Layout({ children }) {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: ssrThemeInitScript() }} />
      </head>
      <body>
        <GraphQLProvider>
          {/* 使用 Suspense 管理 StoreInitLoader 的异步数据加载 */}
          {/* <Suspense fallback={<h1>root layout loading ...</h1>}> */}
          {/* @ts-ignore */}
          <StoreInitLoader>
            {/* GlobalLayout 是作为 prop 传递给 StoreInitLoader 的 children */}
            <GlobalLayout>{children}</GlobalLayout>
          </StoreInitLoader>
          {/* </Suspense> */}
        </GraphQLProvider>
      </body>
    </html>
  )
}
